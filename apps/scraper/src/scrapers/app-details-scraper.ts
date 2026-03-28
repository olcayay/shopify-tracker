import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { scrapeRuns, apps, appSnapshots, appFieldChanges, similarAppSightings, categories, appCategoryRankings, ensurePlatformDeveloper } from "@appranks/db";
import { urls, createLogger, clampRating, clampCount, validatePlatformData, type PlatformId } from "@appranks/shared";

const log = createLogger("app-details-scraper");

/** Normalize a pricing plan object to a canonical key order for stable JSON comparison */
export function normalizePlan(p: any) {
  return {
    name: p.name ?? p.plan_name ?? null,
    price: p.price != null ? String(p.price) : null,
    period: p.period ?? null,
    yearly_price: p.yearly_price != null ? String(p.yearly_price) : null,
    discount_text: p.discount_text ?? null,
    trial_text: p.trial_text ?? null,
    features: p.features ?? [],
    currency_code: p.currency_code ?? null,
    units: p.units ?? null,
  };
}
import { HttpClient } from "../http-client.js";
import { parseAppPage, parseSimilarApps } from "../parsers/app-parser.js";
import type { PlatformModule } from "../platforms/platform-module.js";
import { runConcurrent } from "../utils/run-concurrent.js";
import { recordItemError } from "../utils/record-item-error.js";

/** Strip HTML tags and decode common entities, collapse whitespace */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "\u2013").replace(/&mdash;/g, "\u2014")
    .replace(/&lsquo;/g, "\u2018").replace(/&rsquo;/g, "\u2019")
    .replace(/&ldquo;/g, "\u201C").replace(/&rdquo;/g, "\u201D")
    .replace(/&hellip;/g, "\u2026")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Parse WordPress "last updated" date strings like "2024-11-03 3:14pm GMT"
 * into a proper Date object. Returns null if parsing fails.
 */
function parseWordPressDate(dateStr: string): Date | null {
  try {
    // WordPress format: "2024-11-03 3:14pm GMT" or "2025-01-15 10:00am GMT"
    const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})(am|pm)\s+(\w+)$/i);
    if (match) {
      const [, datePart, hourStr, minStr, ampm] = match;
      let hour = parseInt(hourStr, 10);
      if (ampm.toLowerCase() === "pm" && hour !== 12) hour += 12;
      if (ampm.toLowerCase() === "am" && hour === 12) hour = 0;
      return new Date(`${datePart}T${String(hour).padStart(2, "0")}:${minStr}:00Z`);
    }
    // Fallback: try native Date parsing
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export class AppDetailsScraper {
  private db: Database;
  private httpClient: HttpClient;
  private platform: PlatformId;
  private platformModule?: PlatformModule;
  public jobId?: string;

  constructor(db: Database, httpClient?: HttpClient, platformModule?: PlatformModule) {
    this.db = db;
    this.httpClient = httpClient || new HttpClient();
    this.platformModule = platformModule;
    this.platform = platformModule?.platformId ?? "shopify";
  }

  private get isShopify(): boolean {
    return this.platform === "shopify";
  }

  /** Scrape details for all tracked apps */
  async scrapeTracked(triggeredBy?: string, queue?: string, force?: boolean): Promise<void> {
    const trackedApps = await this.db
      .select({ id: apps.id, slug: apps.slug, name: apps.name })
      .from(apps)
      .where(and(eq(apps.isTracked, true), eq(apps.platform, this.platform)));

    if (trackedApps.length === 0) {
      log.info("no tracked apps found");
      return;
    }

    log.info("scraping tracked apps", { count: trackedApps.length });

    const [run] = await this.db
      .insert(scrapeRuns)
      .values({
        scraperType: "app_details",
        platform: this.platform,
        status: "running",
        createdAt: new Date(),
        startedAt: new Date(),
        triggeredBy,
        queue,
        jobId: this.jobId ?? null,
      })
      .returning();

    const startTime = Date.now();
    let itemsScraped = 0;
    let itemsFailed = 0;

    try {
      await runConcurrent(trackedApps, async (app) => {
        try {
          await this.scrapeApp(app.slug, run.id, triggeredBy, undefined, force);
          itemsScraped++;
        } catch (error) {
          log.error("failed to scrape app", { slug: app.slug, error: String(error) });
          itemsFailed++;
          await recordItemError(this.db, {
            scrapeRunId: run.id,
            itemIdentifier: app.slug,
            itemType: "app",
            url: this.platformModule ? undefined : urls.app(app.slug),
            error,
          });
        }
      }, 3);

      await this.db
        .update(scrapeRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          metadata: {
            items_scraped: itemsScraped,
            items_failed: itemsFailed,
            duration_ms: Date.now() - startTime,
          },
        })
        .where(eq(scrapeRuns.id, run.id));
    } catch (error) {
      await this.db
        .update(scrapeRuns)
        .set({
          status: "failed",
          completedAt: new Date(),
          error: String(error),
          metadata: {
            items_scraped: itemsScraped,
            items_failed: itemsFailed,
            duration_ms: Date.now() - startTime,
          },
        })
        .where(eq(scrapeRuns.id, run.id));
      throw error;
    }

    log.info("scraping complete", { itemsScraped, itemsFailed, durationMs: Date.now() - startTime });
  }

  /** Scrape details for ALL discovered apps (not just tracked) */
  async scrapeAll(triggeredBy?: string, queue?: string, force?: boolean): Promise<void> {
    const allApps = await this.db
      .select({ id: apps.id, slug: apps.slug, name: apps.name })
      .from(apps)
      .where(eq(apps.platform, this.platform));

    if (allApps.length === 0) {
      log.info("no apps found");
      return;
    }

    log.info("scraping all discovered apps", { count: allApps.length });

    const [run] = await this.db
      .insert(scrapeRuns)
      .values({
        scraperType: "app_details",
        platform: this.platform,
        status: "running",
        createdAt: new Date(),
        startedAt: new Date(),
        triggeredBy,
        queue,
        jobId: this.jobId ?? null,
      })
      .returning();

    const startTime = Date.now();
    let itemsScraped = 0;
    let itemsFailed = 0;

    try {
      await runConcurrent(allApps, async (app) => {
        try {
          await this.scrapeApp(app.slug, run.id, triggeredBy, undefined, force);
          itemsScraped++;
          if (itemsScraped % 50 === 0) {
            log.info("progress", { scraped: itemsScraped, failed: itemsFailed, total: allApps.length });
          }
        } catch (error) {
          log.error("failed to scrape app", { slug: app.slug, error: String(error) });
          itemsFailed++;
          await recordItemError(this.db, {
            scrapeRunId: run.id,
            itemIdentifier: app.slug,
            itemType: "app",
            url: this.platformModule ? undefined : urls.app(app.slug),
            error,
          });
        }
      }, 3);

      await this.db
        .update(scrapeRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          metadata: {
            items_scraped: itemsScraped,
            items_failed: itemsFailed,
            duration_ms: Date.now() - startTime,
          },
        })
        .where(eq(scrapeRuns.id, run.id));
    } catch (error) {
      await this.db
        .update(scrapeRuns)
        .set({
          status: "failed",
          completedAt: new Date(),
          error: String(error),
          metadata: {
            items_scraped: itemsScraped,
            items_failed: itemsFailed,
            duration_ms: Date.now() - startTime,
          },
        })
        .where(eq(scrapeRuns.id, run.id));
      throw error;
    }

    log.info("scraping all complete", { itemsScraped, itemsFailed, durationMs: Date.now() - startTime });
  }

  /** Scrape a single app by slug */
  async scrapeApp(slug: string, runId?: string, triggeredBy?: string, queue?: string, force?: boolean): Promise<void> {
    log.info("scraping app", { slug, force });

    // Look up the app's integer ID (or create if needed later)
    const [existingApp] = await this.db
      .select({ id: apps.id })
      .from(apps)
      .where(and(eq(apps.slug, slug), eq(apps.platform, this.platform)))
      .limit(1);

    // Skip if already scraped within 12 hours (unless force=true)
    if (!force && existingApp) {
      const [recentSnapshot] = await this.db
        .select({ scrapedAt: appSnapshots.scrapedAt })
        .from(appSnapshots)
        .where(eq(appSnapshots.appId, existingApp.id))
        .orderBy(desc(appSnapshots.scrapedAt))
        .limit(1);

      if (recentSnapshot) {
        const hoursSince = (Date.now() - recentSnapshot.scrapedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 12) {
          log.info("skipping recently scraped app", { slug, hoursSince: hoursSince.toFixed(1) });
          return;
        }
      }
    }

    // Create run if not provided (standalone mode)
    const isStandalone = !runId;
    const startTime = Date.now();
    if (!runId) {
      const [run] = await this.db
        .insert(scrapeRuns)
        .values({
          scraperType: "app_details",
          platform: this.platform,
          status: "running",
          startedAt: new Date(),
          triggeredBy,
          queue,
          jobId: this.jobId ?? null,
        })
        .returning();
      runId = run.id;
    }

    try {
      // Fetch app page using platform module if available
      const html = this.platformModule
        ? await this.platformModule.fetchAppPage(slug)
        : await this.httpClient.fetchPage(urls.app(slug));

      // Use platform module for non-Shopify or fall back to Shopify parser
      const useGeneric = this.platformModule && !this.isShopify;
      const details = useGeneric
        ? (() => {
            const normalized = this.platformModule!.parseAppDetails(html, slug);
            const pd = normalized.platformData;
            return {
              app_slug: normalized.slug,
              app_name: normalized.name,
              app_introduction: this.platform === "wix"
                ? (pd.tagline as string) || ""
                : this.platform === "wordpress"
                  ? ""
                  : this.platform === "google_workspace"
                    ? (pd.shortDescription as string) || ""
                    : this.platform === "atlassian"
                      ? (pd.summary as string) || ""
                      : (pd.description as string) || "",
              app_details: this.platform === "wix"
                ? (pd.description as string) || ""
                : this.platform === "wordpress"
                  ? stripHtmlTags((pd.description as string) || "")
                  : this.platform === "google_workspace"
                    ? (pd.detailedDescription as string) || ""
                    : this.platform === "atlassian"
                      ? (pd.fullDescription as string) || ""
                      : (pd.fullDescription as string) || "",
              seo_title: this.platform === "wordpress" || this.platform === "google_workspace" ? "" : normalized.name,
              seo_meta_description: this.platform === "wordpress" || this.platform === "google_workspace"
                ? ""
                : (pd.tagline as string) || (pd.description as string) || "",
              features: this.platform === "wix"
                ? (pd.benefits as string[]) || []
                : this.platform === "atlassian"
                  ? ((pd.highlights as Array<{ title: string; body: string }>) || []).map(
                      (h) => h.body ? `${h.title}\n${h.body}` : h.title
                    )
                  : (pd.highlights as string[]) || [],
              pricing: normalized.pricingHint || "",
              average_rating: normalized.averageRating,
              rating_count: normalized.ratingCount,
              icon_url: normalized.iconUrl,
              developer: (normalized.developer
                ? { name: normalized.developer.name, url: normalized.developer.website || normalized.developer.url || "" }
                : { name: "", url: "" }) as import("@appranks/shared").AppDeveloper,
              launched_date: pd.publishedDate
                ? new Date(pd.publishedDate as string)
                : pd.launchedDate
                  ? new Date(pd.launchedDate as string)
                  : null as Date | null,
              demo_store_url: (this.platform === "wix" ? (pd.demoUrl as string) || null : null) as string | null,
              languages: (pd.languages as string[]) || [],
              integrations: (() => {
                if (this.platform === "salesforce") {
                  return [
                    ...((pd.productsSupported as string[]) || []),
                    ...((pd.productsRequired as string[]) || []),
                  ];
                } else if (this.platform === "google_workspace") {
                  return ((pd.worksWithApps as string[]) || []);
                } else if (this.platform === "zoom") {
                  return ((pd.worksWith as string[]) || []);
                }
                return [];
              })(),
              categories: (() => {
                // Platform-specific category mapping
                if (this.platform === "salesforce") {
                  return ((pd.listingCategories as string[]) || []).map(
                    (cat: string) => ({ title: cat, url: "" })
                  );
                } else if (this.platform === "wix") {
                  return ((pd.categories as Array<{ slug?: string; title?: string; parentSlug?: string }>) || []).map(
                    (c) => ({ title: c.title || c.slug || "", url: "" })
                  );
                } else if (this.platform === "wordpress") {
                  const tags = (pd.tags || {}) as Record<string, string>;
                  return Object.values(tags).map(
                    (t: string) => ({ title: t, url: "" })
                  );
                } else if (this.platform === "atlassian") {
                  // Atlassian has both listingCategories (string[]) and categories (object[])
                  const listCats = (pd.listingCategories as string[]) || [];
                  if (listCats.length > 0) {
                    return listCats.map((cat: string) => ({ title: cat, url: "" }));
                  }
                  return ((pd.categories as Array<{ slug?: string; name?: string }>) || []).map(
                    (c) => ({ title: c.name || c.slug || "", url: "" })
                  );
                } else if (this.platform === "zoho") {
                  return ((pd.categories as Array<{ slug?: string }>) || []).map(
                    (c) => ({ title: c.slug || "", url: "" })
                  );
                } else if (this.platform === "zendesk") {
                  return ((pd.categories as Array<{ slug?: string; name?: string }>) || []).map(
                    (c) => ({ title: c.name || c.slug || "", url: "" })
                  );
                } else if (this.platform === "hubspot") {
                  return ((pd.categories as Array<{ slug?: string; displayName?: string }>) || []).map(
                    (c) => ({ title: c.displayName || c.slug || "", url: "" })
                  );
                } else if (this.platform === "google_workspace") {
                  const cat = pd.category as string | undefined;
                  return cat ? [{ title: cat, url: "" }] : [];
                }
                return [];
              })() as import("@appranks/shared").AppCategory[],
              pricing_plans: ((pd.pricingPlans as any[]) || []).map((p: any) => {
                // Platform-specific pricing normalization
                if (this.platform === "atlassian") {
                  return {
                    name: p.name || "",
                    price: p.price != null ? String(p.price) : null,
                    period: p.period === "monthly" ? "month" : p.period === "yearly" ? "year" : p.period || null,
                    yearly_price: p.yearly_price != null ? String(p.yearly_price) : null,
                    discount_text: null,
                    trial_text: p.trialDays > 0 ? `${p.trialDays}-day free trial` : null,
                    features: p.features || [],
                    currency_code: p.currency_code || null,
                    units: p.units || null,
                  };
                } else if (this.platform === "hubspot") {
                  return {
                    name: p.name || "",
                    price: p.monthlyPrice != null ? String(p.monthlyPrice) : (p.price != null ? String(p.price) : null),
                    period: Array.isArray(p.model) ? p.model.join(", ") : (p.model || p.frequency || null),
                    yearly_price: p.yearlyPrice != null ? String(p.yearlyPrice) : null,
                    discount_text: null,
                    trial_text: p.trial_days > 0 ? `${p.trial_days}-day free trial` : null,
                    features: p.features || [],
                    currency_code: p.currency_code || null,
                    units: p.units || null,
                  };
                }
                // Default mapping (Salesforce, Wix, etc.)
                return {
                  name: p.plan_name || p.name || "",
                  price: p.price != null ? String(p.price) : null,
                  period: p.frequency === "monthly" ? "month" : p.frequency === "yearly" ? "year" : p.frequency || null,
                  yearly_price: null,
                  discount_text: null,
                  trial_text: p.trial_days > 0 ? `${p.trial_days}-day free trial` : null,
                  features: [],
                  currency_code: p.currency_code || null,
                  units: p.units || null,
                };
              }) as import("@appranks/shared").PricingPlan[],
              support: (() => {
                if (this.platform === "atlassian") {
                  return (pd.supportEmail || pd.supportUrl || pd.supportPhone)
                    ? { email: (pd.supportEmail as string) || null, portal_url: (pd.supportUrl as string) || null, phone: (pd.supportPhone as string) || null } as import("@appranks/shared").AppSupport
                    : null;
                } else if (this.platform === "wix") {
                  return pd.developerEmail
                    ? { email: (pd.developerEmail as string) || null, portal_url: (pd.developerPrivacyUrl as string) || null, phone: null } as import("@appranks/shared").AppSupport
                    : null;
                } else if (this.platform === "google_workspace") {
                  return (pd.supportUrl || pd.termsOfServiceUrl || pd.privacyPolicyUrl)
                    ? { email: null, portal_url: (pd.supportUrl as string) || null, phone: null } as import("@appranks/shared").AppSupport
                    : null;
                } else if (this.platform === "canva") {
                  return (pd.developerEmail || pd.developerPhone)
                    ? { email: (pd.developerEmail as string) || null, portal_url: (pd.termsUrl as string) || null, phone: (pd.developerPhone as string) || null } as import("@appranks/shared").AppSupport
                    : null;
                }
                return normalized.developer?.website
                  ? { email: (pd.publisher as any)?.email || null, portal_url: normalized.developer.website, phone: null } as import("@appranks/shared").AppSupport
                  : null;
              })() as import("@appranks/shared").AppSupport | null,
              _platformData: pd,
              // First-class metadata columns
              _currentVersion: (this.platform === "wordpress" || this.platform === "atlassian" || this.platform === "zoho" || this.platform === "zendesk")
                ? (pd.version as string) || null
                : null,
              _activeInstalls: this.platform === "wordpress"
                ? (pd.activeInstalls as number) || null
                : this.platform === "google_workspace" || this.platform === "hubspot"
                  ? (pd.installCount as number) || null
                  : this.platform === "atlassian"
                    ? (pd.totalInstalls as number) || null
                    : null,
              _lastUpdatedAt: this.platform === "wordpress" && pd.lastUpdated
                ? parseWordPressDate(pd.lastUpdated as string)
                : this.platform === "google_workspace" && pd.listingUpdated
                  ? new Date(pd.listingUpdated as string)
                  : this.platform === "atlassian" && pd.lastModified
                    ? new Date(pd.lastModified as string)
                    : null,
              _externalId: this.platform === "atlassian" && pd.appId
                ? String(pd.appId)
                : null,
              _badges: normalized.badges,
            };
          })()
        : parseAppPage(html, slug);

      // Change detection: compare against current state
      const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];

      const [currentApp] = await this.db
        .select({ name: apps.name, currentVersion: apps.currentVersion })
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, this.platform)));

      if (currentApp && currentApp.name !== details.app_name) {
        changes.push({ field: "name", oldValue: currentApp.name, newValue: details.app_name });
      }

      // Version change detection (WordPress and other platforms with _currentVersion)
      const newVersion = ("_currentVersion" in details ? (details as any)._currentVersion : null) as string | null;
      if (currentApp && newVersion && currentApp.currentVersion && currentApp.currentVersion !== newVersion) {
        changes.push({ field: "currentVersion", oldValue: currentApp.currentVersion, newValue: newVersion });
      }

      // Get previous snapshot by app ID if we have one
      let prevSnapshot: {
        appIntroduction: string;
        appDetails: string;
        features: string[];
        seoTitle: string;
        seoMetaDescription: string;
        pricingPlans: any[];
      } | undefined;

      if (existingApp) {
        const [snap] = await this.db
          .select({
            appIntroduction: appSnapshots.appIntroduction,
            appDetails: appSnapshots.appDetails,
            features: appSnapshots.features,
            seoTitle: appSnapshots.seoTitle,
            seoMetaDescription: appSnapshots.seoMetaDescription,
            pricingPlans: appSnapshots.pricingPlans,
          })
          .from(appSnapshots)
          .where(eq(appSnapshots.appId, existingApp.id))
          .orderBy(desc(appSnapshots.scrapedAt))
          .limit(1);

        prevSnapshot = snap;
      }

      if (prevSnapshot) {
        const fieldMap: Record<string, [string, string]> = {
          appIntroduction: [prevSnapshot.appIntroduction, details.app_introduction],
          appDetails: [prevSnapshot.appDetails, details.app_details],
          seoTitle: [prevSnapshot.seoTitle, details.seo_title],
          seoMetaDescription: [prevSnapshot.seoMetaDescription, details.seo_meta_description],
        };
        for (const [field, [oldVal, newVal]] of Object.entries(fieldMap)) {
          // Skip when old value was empty (first-time population, not a real change)
          if (oldVal !== newVal && oldVal) {
            changes.push({ field, oldValue: oldVal, newValue: newVal });
          }
        }
        const oldFeatures = JSON.stringify(prevSnapshot.features);
        const newFeatures = JSON.stringify(details.features);
        // Skip when features were empty (first-time population)
        if (oldFeatures !== newFeatures && oldFeatures !== "[]") {
          changes.push({ field: "features", oldValue: oldFeatures, newValue: newFeatures });
        }

        const oldPlans = JSON.stringify((prevSnapshot.pricingPlans || []).map(normalizePlan));
        const newPlans = JSON.stringify((details.pricing_plans || []).map(normalizePlan));
        if (oldPlans !== newPlans && oldPlans !== "[]") {
          changes.push({ field: "pricingPlans", oldValue: oldPlans, newValue: newPlans });
        }
      }

      // Extract first-class metadata columns if present
      const metaVersion = ("_currentVersion" in details ? (details as any)._currentVersion : null) as string | null;
      const metaInstalls = ("_activeInstalls" in details ? (details as any)._activeInstalls : null) as number | null;
      const metaLastUpdated = ("_lastUpdatedAt" in details ? (details as any)._lastUpdatedAt : null) as Date | null;
      const metaExternalId = ("_externalId" in details ? (details as any)._externalId : null) as string | null;
      const metaBadges = ("_badges" in details ? (details as any)._badges : null) as string[] | null;

      // Sanity-check parsed data before DB insert
      const validRating = clampRating(details.average_rating);
      const validRatingCount = clampCount(details.rating_count);
      if (details.average_rating != null && validRating == null) {
        log.warn("invalid rating value, skipping", { slug, rating: details.average_rating });
      }
      if (details.rating_count != null && validRatingCount == null) {
        log.warn("invalid rating count, skipping", { slug, ratingCount: details.rating_count });
      }

      // Upsert app master record
      const [upsertedApp] = await this.db
        .insert(apps)
        .values({
          platform: this.platform,
          slug,
          name: details.app_name,
          isTracked: true,
          launchedDate: details.launched_date,
          iconUrl: details.icon_url,
          pricingHint: details.pricing || undefined,
          ...(validRating != null && { averageRating: String(validRating) }),
          ...(validRatingCount != null && { ratingCount: validRatingCount }),
          ...(metaVersion != null && { currentVersion: metaVersion }),
          ...(metaInstalls != null && { activeInstalls: metaInstalls }),
          ...(metaLastUpdated != null && { lastUpdatedAt: metaLastUpdated }),
          ...(metaExternalId != null && { externalId: metaExternalId }),
          ...(metaBadges && metaBadges.length > 0 && { badges: metaBadges }),
        })
        .onConflictDoUpdate({
          target: [apps.platform, apps.slug],
          set: {
            name: details.app_name,
            launchedDate: details.launched_date,
            iconUrl: details.icon_url,
            pricingHint: details.pricing || undefined,
            updatedAt: new Date(),
            ...(validRating != null && { averageRating: String(validRating) }),
            ...(validRatingCount != null && { ratingCount: validRatingCount }),
            ...(metaVersion != null && { currentVersion: metaVersion }),
            ...(metaInstalls != null && { activeInstalls: metaInstalls }),
            ...(metaLastUpdated != null && { lastUpdatedAt: metaLastUpdated }),
            ...(metaExternalId != null && { externalId: metaExternalId }),
            ...(metaBadges && metaBadges.length > 0 && { badges: metaBadges }),
          },
        })
        .returning({ id: apps.id });

      const appId = upsertedApp.id;

      if (changes.length > 0) {
        await this.db.insert(appFieldChanges).values(
          changes.map((c) => ({
            appId,
            field: c.field,
            oldValue: c.oldValue,
            newValue: c.newValue,
            scrapeRunId: runId!,
          }))
        );
        log.info("detected field changes", { slug, fields: changes.map((c) => c.field) });
      }

      // Resolve category slugs before saving snapshot
      // For non-Shopify: look up correct slugs from DB (e.g. camelCase Salesforce slugs)
      // Uses title match first, then falls back to camelCase slug match
      const resolvedCategories = details.categories;
      const catSlugMap = new Map<string, string>();
      if (resolvedCategories.length > 0 && !this.isShopify) {
        const existingCats = await this.db
          .select({ slug: categories.slug, title: categories.title })
          .from(categories)
          .where(eq(categories.platform, this.platform));
        const titleToSlug = new Map(existingCats.map(c => [c.title.toLowerCase(), c.slug]));
        const slugSet = new Set(existingCats.map(c => c.slug));

        for (const cat of resolvedCategories) {
          // Primary: match by title (case-insensitive)
          let resolved = titleToSlug.get(cat.title.toLowerCase());

          // Fallback: convert title to camelCase slug and match by slug
          if (!resolved) {
            const camelSlug = titleToCamelCase(cat.title);
            if (slugSet.has(camelSlug)) {
              resolved = camelSlug;
            }
          }

          if (resolved) {
            cat.url = `/categories/${resolved}`;
            catSlugMap.set(cat.title, resolved);
          } else {
            log.warn("unresolved category", { slug, category: cat.title, platform: this.platform });
          }
        }
      }

      // Validate platformData against Zod schema BEFORE DB insert
      let platformDataToStore = (("_platformData" in details ? details._platformData : undefined) ?? {}) as Record<string, unknown>;
      if (platformDataToStore && Object.keys(platformDataToStore).length > 0) {
        const validation = validatePlatformData(this.platform, platformDataToStore);
        if (!validation.success) {
          const validationErrors = validation.errors.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
          log.error("platformData validation failed", {
            platform: this.platform,
            slug,
            errors: validationErrors,
          });
          // Store validation errors alongside the data so they're visible in DB
          platformDataToStore = { ...platformDataToStore, _validationErrors: validationErrors };
        }
      }

      // Insert snapshot
      await this.db.insert(appSnapshots).values({
        appId,
        scrapeRunId: runId,
        scrapedAt: new Date(),
        appIntroduction: details.app_introduction,
        appDetails: details.app_details,
        seoTitle: details.seo_title,
        seoMetaDescription: details.seo_meta_description,
        features: details.features,
        pricing: details.pricing,
        averageRating: validRating?.toString() ?? null,
        ratingCount: validRatingCount,
        developer: details.developer,
        demoStoreUrl: details.demo_store_url,
        languages: details.languages,
        integrations: details.integrations,
        categories: resolvedCategories,
        pricingPlans: details.pricing_plans,
        support: details.support,
        platformData: platformDataToStore as Record<string, unknown>,
      });

      // Link developer to global developer profile
      if (details.developer?.name) {
        try {
          await ensurePlatformDeveloper(
            this.db,
            this.platform,
            details.developer.name,
            details.developer.website || details.developer.url || null
          );
        } catch (err) {
          log.warn("failed to link developer", { slug, developer: details.developer.name, error: (err as Error).message });
        }
      }

      // Register category rankings from snapshot data
      if (resolvedCategories.length > 0) {
        for (const cat of resolvedCategories) {
          let catSlug: string;
          if (this.isShopify) {
            const slugMatch = cat.url.match(/\/categories\/([^/]+)/);
            if (!slugMatch) continue;
            catSlug = slugMatch[1];

            // Shopify: ensure category exists in DB
            await this.db
              .insert(categories)
              .values({
                platform: this.platform,
                slug: catSlug,
                title: cat.title,
                url: cat.url || "",
                parentSlug: null,
                categoryLevel: 0,
                isTracked: false,
                isListingPage: true,
              })
              .onConflictDoNothing({ target: [categories.platform, categories.slug] });
          } else {
            // Non-Shopify: only match existing DB categories, never create new ones
            const resolved = catSlugMap.get(cat.title);
            if (!resolved) continue;
            catSlug = resolved;
          }

          // Link the app to this category via rankings (position 0 = linked but unranked).
          // Skip if the category scraper already recorded a real position today.
          if (!this.isShopify) {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const [existing] = await this.db
              .select({ position: appCategoryRankings.position })
              .from(appCategoryRankings)
              .where(
                and(
                  eq(appCategoryRankings.appId, appId),
                  eq(appCategoryRankings.categorySlug, catSlug),
                  sql`${appCategoryRankings.scrapedAt} >= ${todayStart.toISOString()}`,
                  sql`${appCategoryRankings.position} > 0`
                )
              )
              .limit(1);
            if (!existing) {
              await this.db
                .insert(appCategoryRankings)
                .values({
                  appId,
                  categorySlug: catSlug,
                  scrapeRunId: runId!,
                  scrapedAt: new Date(),
                  position: 0,
                });
            }
          }
        }
      }

      // WordPress: discover new tags from plugin metadata, upsert as categories, and link app to each tag
      if (this.platform === "wordpress" && this.platformModule?.extractCategorySlugs) {
        const pd = (("_platformData" in details ? (details as any)._platformData : undefined) ?? {}) as Record<string, unknown>;
        const tagSlugs = this.platformModule.extractCategorySlugs(pd);
        const tags = (pd.tags || {}) as Record<string, string>;
        if (tagSlugs.length > 0) {
          let newTags = 0;
          for (const tagSlug of tagSlugs) {
            const tagTitle = tags[tagSlug] || tagSlug.replace(/-/g, " ");
            const result = await this.db
              .insert(categories)
              .values({
                platform: "wordpress",
                slug: tagSlug,
                title: tagTitle.charAt(0).toUpperCase() + tagTitle.slice(1),
                url: `https://wordpress.org/plugins/tags/${tagSlug}/`,
                parentSlug: null,
                categoryLevel: 0,
                isTracked: false,
                isListingPage: true,
              })
              .onConflictDoNothing({ target: [categories.platform, categories.slug] });
            if ((result as any).rowCount > 0) newTags++;

            // Link app to this tag via category rankings (position 0 = linked but unranked).
            // Skip if the category scraper already recorded a real position today.
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const [existingTagRanking] = await this.db
              .select({ position: appCategoryRankings.position })
              .from(appCategoryRankings)
              .where(
                and(
                  eq(appCategoryRankings.appId, appId),
                  eq(appCategoryRankings.categorySlug, tagSlug),
                  sql`${appCategoryRankings.scrapedAt} >= ${todayStart.toISOString()}`,
                  sql`${appCategoryRankings.position} > 0`
                )
              )
              .limit(1);
            if (!existingTagRanking) {
              await this.db
                .insert(appCategoryRankings)
                .values({
                  appId,
                  categorySlug: tagSlug,
                  scrapeRunId: runId!,
                  scrapedAt: new Date(),
                  position: 0,
                });
            }
          }
          if (newTags > 0) {
            log.info("discovered new WordPress tags", { slug, newTags, totalTags: tagSlugs.length });
          }
        }
      }

      // Record similar apps ("More apps like this") - Shopify only
      const similarApps = this.isShopify ? parseSimilarApps(html) : [];
      if (similarApps.length > 0) {
        const todayStr = new Date().toISOString().slice(0, 10);
        for (const similar of similarApps) {
          // Ensure similar app exists in apps table
          const [upsertedSimilar] = await this.db
            .insert(apps)
            .values({
              platform: this.platform,
              slug: similar.slug,
              name: similar.name,
              iconUrl: similar.icon_url || null,
            })
            .onConflictDoUpdate({
              target: [apps.platform, apps.slug],
              set: {
                name: similar.name,
                iconUrl: similar.icon_url || undefined,
                updatedAt: new Date(),
              },
            })
            .returning({ id: apps.id });

          // Upsert sighting (one per appId + similarAppId + date)
          await this.db
            .insert(similarAppSightings)
            .values({
              appId,
              similarAppId: upsertedSimilar.id,
              position: similar.position ?? null,
              seenDate: todayStr,
              firstSeenRunId: runId!,
              lastSeenRunId: runId!,
              timesSeenInDay: 1,
            })
            .onConflictDoUpdate({
              target: [
                similarAppSightings.appId,
                similarAppSightings.similarAppId,
                similarAppSightings.seenDate,
              ],
              set: {
                lastSeenRunId: runId!,
                position: similar.position ?? null,
                timesSeenInDay: sql`${similarAppSightings.timesSeenInDay} + 1`,
              },
            });
        }
        log.info("recorded similar apps", { slug, count: similarApps.length });
      }

      // Complete the run in standalone mode
      if (isStandalone) {
        await this.db
          .update(scrapeRuns)
          .set({
            status: "completed",
            completedAt: new Date(),
            metadata: {
              items_scraped: 1,
              items_failed: 0,
              duration_ms: Date.now() - startTime,
            },
          })
          .where(eq(scrapeRuns.id, runId));
      }
    } catch (error) {
      if (isStandalone) {
        await this.db
          .update(scrapeRuns)
          .set({
            status: "failed",
            completedAt: new Date(),
            error: String(error),
            metadata: { duration_ms: Date.now() - startTime },
          })
          .where(eq(scrapeRuns.id, runId));
      }
      throw error;
    }
  }
}

/**
 * Convert a human-readable category title to a camelCase slug.
 * Examples:
 *   "Customer Service" → "customerService"
 *   "Agent Productivity" → "agentProductivity"
 *   "IT & Administration" → "itAndAdministration"
 *   "Data Management" → "dataManagement"
 */
function titleToCamelCase(title: string): string {
  return title
    .replace(/&/g, "And")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join("");
}
