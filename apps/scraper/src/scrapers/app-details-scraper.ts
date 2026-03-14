import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { scrapeRuns, apps, appSnapshots, appFieldChanges, similarAppSightings, categories, appCategoryRankings } from "@appranks/db";
import { urls, createLogger, type PlatformId } from "@appranks/shared";

const log = createLogger("app-details-scraper");
import { HttpClient } from "../http-client.js";
import { parseAppPage, parseSimilarApps } from "../parsers/app-parser.js";
import type { PlatformModule } from "../platforms/platform-module.js";

export class AppDetailsScraper {
  private db: Database;
  private httpClient: HttpClient;
  private platform: PlatformId;
  private platformModule?: PlatformModule;

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
      })
      .returning();

    const startTime = Date.now();
    let itemsScraped = 0;
    let itemsFailed = 0;

    for (const app of trackedApps) {
      try {
        await this.scrapeApp(app.slug, run.id, triggeredBy, undefined, force);
        itemsScraped++;
      } catch (error) {
        log.error("failed to scrape app", { slug: app.slug, error: String(error) });
        itemsFailed++;
      }
    }

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

    log.info("scraping complete", { itemsScraped, itemsFailed, durationMs: Date.now() - startTime });
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
              app_introduction: (pd.description as string) || "",
              app_details: (pd.fullDescription as string) || "",
              seo_title: normalized.name,
              seo_meta_description: (pd.description as string) || "",
              features: (pd.highlights as string[]) || [],
              pricing: normalized.pricingHint || "",
              average_rating: normalized.averageRating,
              rating_count: normalized.ratingCount,
              icon_url: normalized.iconUrl,
              developer: (normalized.developer
                ? { name: normalized.developer.name, url: normalized.developer.website || normalized.developer.url || "" }
                : { name: "", url: "" }) as import("@appranks/shared").AppDeveloper,
              launched_date: pd.publishedDate
                ? new Date(pd.publishedDate as string)
                : null as Date | null,
              demo_store_url: null as string | null,
              languages: (pd.languages as string[]) || [],
              integrations: [
                ...((pd.productsSupported as string[]) || []),
                ...((pd.productsRequired as string[]) || []),
              ],
              categories: ((pd.listingCategories as string[]) || []).map(
                (cat) => ({ title: cat, url: "" })
              ) as import("@appranks/shared").AppCategory[],
              pricing_plans: ((pd.pricingPlans as any[]) || []).map((p: any) => ({
                name: p.plan_name || p.name || "",
                price: p.price != null ? String(p.price) : null,
                period: p.frequency === "monthly" ? "month" : p.frequency === "yearly" ? "year" : p.frequency || null,
                yearly_price: null,
                discount_text: null,
                trial_text: p.trial_days > 0 ? `${p.trial_days}-day free trial` : null,
                features: [],
                currency_code: p.currency_code || null,
                units: p.units || null,
              })) as import("@appranks/shared").PricingPlan[],
              support: normalized.developer?.website
                ? { email: (pd.publisher as any)?.email || null, portal_url: normalized.developer.website, phone: null } as import("@appranks/shared").AppSupport
                : null as import("@appranks/shared").AppSupport | null,
              _platformData: pd,
            };
          })()
        : parseAppPage(html, slug);

      // Change detection: compare against current state
      const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];

      const [currentApp] = await this.db
        .select({ name: apps.name })
        .from(apps)
        .where(and(eq(apps.slug, slug), eq(apps.platform, this.platform)));

      if (currentApp && currentApp.name !== details.app_name) {
        changes.push({ field: "name", oldValue: currentApp.name, newValue: details.app_name });
      }

      // Get previous snapshot by app ID if we have one
      let prevSnapshot: {
        appIntroduction: string;
        appDetails: string;
        features: string[];
        seoTitle: string;
        seoMetaDescription: string;
      } | undefined;

      if (existingApp) {
        const [snap] = await this.db
          .select({
            appIntroduction: appSnapshots.appIntroduction,
            appDetails: appSnapshots.appDetails,
            features: appSnapshots.features,
            seoTitle: appSnapshots.seoTitle,
            seoMetaDescription: appSnapshots.seoMetaDescription,
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
        })
        .onConflictDoUpdate({
          target: [apps.platform, apps.slug],
          set: {
            name: details.app_name,
            launchedDate: details.launched_date,
            iconUrl: details.icon_url,
            updatedAt: new Date(),
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
        averageRating: details.average_rating?.toString() ?? null,
        ratingCount: details.rating_count,
        developer: details.developer,
        demoStoreUrl: details.demo_store_url,
        languages: details.languages,
        integrations: details.integrations,
        categories: resolvedCategories,
        pricingPlans: details.pricing_plans,
        support: details.support,
        platformData: (("_platformData" in details ? details._platformData : undefined) ?? {}) as Record<string, unknown>,
      });

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

          // Link the app to this category via rankings
          if (!this.isShopify) {
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
