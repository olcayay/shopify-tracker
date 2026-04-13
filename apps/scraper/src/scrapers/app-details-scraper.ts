import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { scrapeRuns, apps, appSnapshots, appFieldChanges, similarAppSightings, categories, appCategoryRankings, ensurePlatformDeveloper, platformDevelopers } from "@appranks/db";
import { urls, createLogger, clampRating, clampCount, validatePlatformData, normalizePricingModel, type PlatformId } from "@appranks/shared";
import { AppNotFoundError } from "../utils/app-not-found-error.js";
import type { ResolvedScraperConfig } from "../config-resolver.js";

const log = createLogger("app-details-scraper");

/** Detect HTTP 404 in a thrown error from HttpClient/platform fetchers. */
export function is404Error(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return /\bHTTP 404\b/.test(msg);
}

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
import type { PlatformModule, NormalizedCategoryApp } from "../platforms/platform-module.js";
import { runConcurrent } from "../utils/run-concurrent.js";
import { resolveParentRunId } from "../utils/parent-run-id.js";
import { recordItemError } from "../utils/record-item-error.js";
import { upsertSnapshotFromCategoryCard } from "../utils/upsert-snapshot-from-card.js";

/** Snapshot fields needed for change detection */
interface PrevSnapshotData {
  appIntroduction: string;
  appDetails: string;
  features: string[];
  seoTitle: string;
  seoMetaDescription: string;
  pricingPlans: any[];
}

/** Pre-fetched data maps to avoid per-app DB queries in batch scraping */
export interface PreFetchedData {
  existingApps: Map<string, { id: number }>;
  recentSnapshots: Map<number, Date>;
  currentApps: Map<string, { name: string; currentVersion: string | null }>;
  prevSnapshots: Map<number, PrevSnapshotData>;
  existingDevelopers: Map<string, number>;
}

/** Known platform boilerplate meta descriptions — indicate scraper got shell page, not app content */
const BOILERPLATE_META: Record<string, string[]> = {
  shopify: ["Shopify App Store, download apps for your Shopify store"],
  canva: ["Discover apps and integrations for Canva"],
  wordpress: ["WordPress.org Plugin Directory"],
  salesforce: ["Salesforce AppExchange"],
};

/** Check if a seoMetaDescription matches a known platform boilerplate */
export function isBoilerplateMeta(meta: string, platform: string): boolean {
  const patterns = BOILERPLATE_META[platform];
  if (!patterns) return false;
  const trimmed = meta.trim().toLowerCase();
  return patterns.some((p) => trimmed.startsWith(p.toLowerCase()));
}

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
  public resolvedConfig?: ResolvedScraperConfig;

  /**
   * Pick a config value with fallback priority: resolved (DB overrides) → platform constants → provided default.
   * Supports dotted paths (e.g. "rateLimit.minDelayMs").
   */
  private configValue<T>(key: string, fallback: T): T {
    const read = (src: unknown, path: string): unknown => {
      if (!src || typeof src !== "object") return undefined;
      const parts = path.split(".");
      let cursor: any = src;
      for (const part of parts) {
        if (cursor == null || typeof cursor !== "object") return undefined;
        cursor = cursor[part];
      }
      return cursor;
    };
    const resolved = read(this.resolvedConfig?.merged, key);
    if (resolved !== undefined) return resolved as T;
    const fromPlatform = read(this.platformModule?.constants as unknown, key);
    if (fromPlatform !== undefined) return fromPlatform as T;
    return fallback;
  }

  constructor(db: Database, httpClient?: HttpClient, platformModule?: PlatformModule) {
    this.db = db;
    this.httpClient = httpClient || new HttpClient();
    this.platformModule = platformModule;
    this.platform = platformModule?.platformId ?? "shopify";
  }

  private get isShopify(): boolean {
    return this.platform === "shopify";
  }

  /** Bulk-fetch app data for all platform apps to avoid per-app DB queries */
  private async buildPreFetchedData(force?: boolean): Promise<PreFetchedData> {
    const existingApps = new Map<string, { id: number }>();
    const recentSnapshots = new Map<number, Date>();
    const currentApps = new Map<string, { name: string; currentVersion: string | null }>();

    // Fetch all existing apps for this platform
    const allExisting = await this.db
      .select({ id: apps.id, slug: apps.slug, name: apps.name, currentVersion: apps.currentVersion })
      .from(apps)
      .where(eq(apps.platform, this.platform));

    for (const app of allExisting) {
      existingApps.set(app.slug, { id: app.id });
      currentApps.set(app.slug, { name: app.name, currentVersion: app.currentVersion });
    }

    // Fetch most recent snapshot dates (for 12h skip check)
    if (!force && allExisting.length > 0) {
      const appIds = allExisting.map((a) => a.id);
      // Process in chunks to avoid query size limits
      const chunkSize = 500;
      for (let i = 0; i < appIds.length; i += chunkSize) {
        const chunk = appIds.slice(i, i + chunkSize);
        const snapshots = await this.db
          .select({
            appId: appSnapshots.appId,
            scrapedAt: sql<Date>`MAX(${appSnapshots.scrapedAt})`.as("scrapedAt"),
          })
          .from(appSnapshots)
          .where(sql`${appSnapshots.appId} IN (${sql.join(chunk.map((id) => sql`${id}`), sql`, `)})`)
          .groupBy(appSnapshots.appId);

        for (const snap of snapshots) {
          recentSnapshots.set(snap.appId, new Date(snap.scrapedAt));
        }
      }
    }

    // Pre-fetch latest snapshots for change detection (DISTINCT ON for efficiency)
    const prevSnapshots = new Map<number, PrevSnapshotData>();
    if (allExisting.length > 0) {
      const appIds = allExisting.map((a) => a.id);
      const chunkSize = 200; // smaller chunks for snapshot data (large text fields)
      for (let i = 0; i < appIds.length; i += chunkSize) {
        const chunk = appIds.slice(i, i + chunkSize);
        const snaps = await this.db.execute<{
          app_id: number;
          app_introduction: string;
          app_details: string;
          features: string[];
          seo_title: string;
          seo_meta_description: string;
          pricing_plans: any[];
        }>(sql`
          SELECT DISTINCT ON (app_id) app_id, app_introduction, app_details, features, seo_title, seo_meta_description, pricing_plans
          FROM app_snapshots
          WHERE app_id IN (${sql.join(chunk.map((id) => sql`${id}`), sql`, `)})
          ORDER BY app_id, scraped_at DESC
        `);
        for (const snap of snaps) {
          prevSnapshots.set(snap.app_id, {
            appIntroduction: snap.app_introduction,
            appDetails: snap.app_details,
            features: snap.features,
            seoTitle: snap.seo_title,
            seoMetaDescription: snap.seo_meta_description,
            pricingPlans: snap.pricing_plans,
          });
        }
      }
    }

    // Pre-fetch existing platform developers (skip ensurePlatformDeveloper for known devs)
    const existingDevelopers = new Map<string, number>();
    const devRows = await this.db
      .select({ name: platformDevelopers.name, globalDeveloperId: platformDevelopers.globalDeveloperId })
      .from(platformDevelopers)
      .where(eq(platformDevelopers.platform, this.platform));
    for (const d of devRows) {
      existingDevelopers.set(d.name, d.globalDeveloperId);
    }

    log.info("pre-fetched app data", {
      existingApps: existingApps.size,
      recentSnapshots: recentSnapshots.size,
      prevSnapshots: prevSnapshots.size,
      existingDevelopers: existingDevelopers.size,
      platform: this.platform,
    });

    return { existingApps, recentSnapshots, currentApps, prevSnapshots, existingDevelopers };
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
        metadata: this.resolvedConfig
          ? { config_snapshot: { merged: this.resolvedConfig.merged, overrides: this.resolvedConfig.overrides } }
          : undefined,
      })
      .returning();

    const startTime = Date.now();
    let itemsScraped = 0;
    let itemsSkippedFresh = 0;
    let itemsFailed = 0;

    const currentlyProcessing = new Set<string>();
    const preFetched = await this.buildPreFetchedData(force);

    try {
      await runConcurrent(trackedApps, async (app, index) => {
        currentlyProcessing.add(app.slug);
        // Update progress metadata periodically (not every app) to reduce DB pressure
        if (index % 5 === 0 || index === trackedApps.length - 1) {
          await this.db.update(scrapeRuns).set({
            metadata: {
              items_scraped: itemsScraped,
              items_skipped_fresh: itemsSkippedFresh,
              items_failed: itemsFailed,
              duration_ms: Date.now() - startTime,
              currently_processing: [...currentlyProcessing],
              current_index: index,
              total_apps: trackedApps.length,
            },
          }).where(eq(scrapeRuns.id, run.id));
        }

        try {
          const outcome = await this.scrapeApp(app.slug, run.id, triggeredBy, undefined, force, preFetched);
          if (outcome === "skipped_fresh") itemsSkippedFresh++;
          else itemsScraped++;
        } catch (error) {
          if (error instanceof AppNotFoundError) {
            // App was delisted/removed from the marketplace — not a scrape failure
            log.warn("app not found on marketplace (likely delisted)", {
              slug: app.slug,
              platform: this.platform,
              detail: error.message,
            });
            itemsScraped++; // count as "processed" not "failed"
          } else {
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
        } finally {
          currentlyProcessing.delete(app.slug);
        }
      }, this.configValue("appDetailsConcurrency", 3));

      await this.db
        .update(scrapeRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          metadata: {
            items_scraped: itemsScraped,
            items_skipped_fresh: itemsSkippedFresh,
            items_failed: itemsFailed,
            total_processed: itemsScraped + itemsSkippedFresh + itemsFailed,
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
            items_skipped_fresh: itemsSkippedFresh,
            items_failed: itemsFailed,
            total_processed: itemsScraped + itemsSkippedFresh + itemsFailed,
            duration_ms: Date.now() - startTime,
          },
        })
        .where(eq(scrapeRuns.id, run.id));
      throw error;
    } finally {
      // Clean up browser if the platform module has one (e.g. Canva)
      if (this.platformModule && "closeBrowser" in this.platformModule && typeof (this.platformModule as any).closeBrowser === "function") {
        await (this.platformModule as any).closeBrowser().catch((e: unknown) => log.warn("failed to close browser", { error: String(e) }));
      }
    }

    log.info("scraping complete", { itemsScraped, itemsSkippedFresh, itemsFailed, durationMs: Date.now() - startTime });
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

    const parentRunId = await resolveParentRunId(this.db, queue, this.jobId ? String(this.jobId) : null);
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
        parentRunId,
        metadata: this.resolvedConfig
          ? { config_snapshot: { merged: this.resolvedConfig.merged, overrides: this.resolvedConfig.overrides }, scope: "all" }
          : { scope: "all" },
      })
      .returning();

    const startTime = Date.now();
    let itemsScraped = 0;
    let itemsSkippedFresh = 0;
    let itemsFailed = 0;
    const preFetchedAll = await this.buildPreFetchedData(force);
    const currentlyProcessing = new Set<string>();

    try {
      await runConcurrent(allApps, async (app, index) => {
        currentlyProcessing.add(app.slug);
        if (index % 25 === 0 || index === allApps.length - 1) {
          await this.db.update(scrapeRuns).set({
            metadata: {
              items_scraped: itemsScraped,
              items_skipped_fresh: itemsSkippedFresh,
              items_failed: itemsFailed,
              duration_ms: Date.now() - startTime,
              currently_processing: [...currentlyProcessing],
              current_index: index,
              total_apps: allApps.length,
              scope: "all",
            },
          }).where(eq(scrapeRuns.id, run.id));
        }

        try {
          const outcome = await this.scrapeApp(app.slug, run.id, triggeredBy, undefined, force, preFetchedAll);
          if (outcome === "skipped_fresh") itemsSkippedFresh++;
          else itemsScraped++;
          const processed = itemsScraped + itemsSkippedFresh;
          if (processed % 50 === 0) {
            log.info("progress", { scraped: itemsScraped, skipped: itemsSkippedFresh, failed: itemsFailed, total: allApps.length });
          }
        } catch (error) {
          if (error instanceof AppNotFoundError) {
            log.warn("app not found on marketplace (likely delisted)", {
              slug: app.slug,
              platform: this.platform,
              detail: error.message,
            });
            itemsScraped++;
          } else {
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
        } finally {
          currentlyProcessing.delete(app.slug);
        }
      }, this.configValue(
        "appDetailsConcurrencyBulk",
        Math.min(this.configValue("appDetailsConcurrency", 3), 3),
      ));

      await this.db
        .update(scrapeRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          metadata: {
            items_scraped: itemsScraped,
            items_skipped_fresh: itemsSkippedFresh,
            items_failed: itemsFailed,
            total_processed: itemsScraped + itemsSkippedFresh + itemsFailed,
            duration_ms: Date.now() - startTime,
            total_apps: allApps.length,
            scope: "all",
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
            items_skipped_fresh: itemsSkippedFresh,
            items_failed: itemsFailed,
            total_processed: itemsScraped + itemsSkippedFresh + itemsFailed,
            duration_ms: Date.now() - startTime,
            total_apps: allApps.length,
            scope: "all",
          },
        })
        .where(eq(scrapeRuns.id, run.id));
      throw error;
    }

    log.info("scraping all complete", { itemsScraped, itemsFailed, durationMs: Date.now() - startTime });
  }

  /**
   * Bulk refresh every app in the catalog using only the platform's category API,
   * bypassing the per-app SPA browser fetch. For platforms where the category API
   * returns the tracked fields (Salesforce), this is ~1000× faster than scope=all.
   *
   * Flow:
   *   1. Fetch every category page (seeds + subcategoryLinks up to maxCategoryDepth).
   *   2. Parse each page into NormalizedCategoryApp[]; dedupe across categories
   *      and aggregate which category slugs referenced each app.
   *   3. For each app: upsert the row in `apps`, then call the shared
   *      upsertSnapshotFromCategoryCard helper (also used by CategoryScraper)
   *      so change detection + refresh semantics match PLA-1049.
   */
  async scrapeAllViaCategoryApi(triggeredBy?: string, queue?: string, _force?: boolean): Promise<void> {
    if (!this.platformModule) {
      throw new Error("scrapeAllViaCategoryApi requires a platform module");
    }
    const module = this.platformModule;

    const parentRunId = await resolveParentRunId(this.db, queue, this.jobId ? String(this.jobId) : null);
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
        parentRunId,
        metadata: { scope: "bulk_via_category" },
      })
      .returning();

    const startTime = Date.now();
    const seeds = module.constants.seedCategories;
    const maxDepth = Math.max(0, module.constants.maxCategoryDepth ?? 0);
    const httpConcurrency = this.configValue<number>("concurrentSeedCategories", 5);
    const refresh = this.configValue<boolean>("refreshSnapshotFromCategoryCard", false);
    const maxAgeMs = this.configValue<number>("refreshSnapshotMaxAgeMs", 20 * 60 * 60 * 1000);

    const cardBySlug = new Map<string, { card: NormalizedCategoryApp; categories: Set<string> }>();
    const fetchedCategories = new Set<string>();
    let categoryFailures = 0;

    async function fetchAndParse(slug: string): Promise<{ apps: NormalizedCategoryApp[]; subLinks: string[] } | null> {
      try {
        const raw = await module.fetchCategoryPage(slug);
        if (!raw) return { apps: [], subLinks: [] };
        const page = module.parseCategoryPage(raw, slug);
        const subLinks = (page.subcategoryLinks ?? []).map((l) => l.slug);
        return { apps: page.apps, subLinks };
      } catch (err) {
        categoryFailures++;
        log.warn("bulk_via_category: failed to fetch category, skipping", {
          platform: module.platformId,
          slug,
          error: String(err),
        });
        return null;
      }
    }

    function mergeCards(categorySlug: string, cards: NormalizedCategoryApp[]): void {
      for (const card of cards) {
        if (!card.slug) continue;
        const existing = cardBySlug.get(card.slug);
        if (existing) {
          existing.categories.add(categorySlug);
          // Prefer the richer card (one with a higher ratingCount signals a more populated card).
          if ((card.ratingCount ?? 0) > (existing.card.ratingCount ?? 0)) {
            existing.card = card;
          }
        } else {
          cardBySlug.set(card.slug, { card, categories: new Set([categorySlug]) });
        }
      }
    }

    // Depth 0 = seeds only. Each additional depth visits the subcategoryLinks
    // reported by the parser at the previous level.
    let frontier = [...seeds];
    for (let depth = 0; depth <= maxDepth; depth++) {
      const toFetch = frontier.filter((s) => !fetchedCategories.has(s));
      if (toFetch.length === 0) break;
      for (const slug of toFetch) fetchedCategories.add(slug);

      const nextFrontier = new Set<string>();
      await runConcurrent(toFetch, async (slug) => {
        const result = await fetchAndParse(slug);
        if (!result) return;
        mergeCards(slug, result.apps);
        for (const sub of result.subLinks) {
          if (!fetchedCategories.has(sub)) nextFrontier.add(sub);
        }
      }, httpConcurrency);
      frontier = [...nextFrontier];
    }

    const totalApps = cardBySlug.size;
    log.info("bulk_via_category: discovered apps", {
      platform: this.platform,
      totalApps,
      categoriesFetched: fetchedCategories.size,
      categoryFailures,
    });

    const now = new Date();
    let itemsScraped = 0;
    let itemsSkippedNoDrift = 0;
    let itemsFailed = 0;
    let snapshotsInserted = 0;
    const upsertStart = Date.now();
    log.info("bulk_via_category: upsert phase started", {
      platform: this.platform,
      totalApps,
      concurrency: this.configValue<number>("appDetailsConcurrencyBulk", 5),
    });

    try {
      const entries = [...cardBySlug.entries()];
      await runConcurrent(entries, async ([slug, { card }], index) => {
        if (index % 500 === 0 || index === entries.length - 1) {
          const elapsed = Date.now() - upsertStart;
          log.info("bulk_via_category: progress", {
            platform: this.platform,
            index,
            totalApps,
            itemsScraped,
            itemsSkippedNoDrift,
            itemsFailed,
            snapshotsInserted,
            elapsedMs: elapsed,
            avgMsPerItem: itemsScraped > 0 ? Math.round(elapsed / itemsScraped) : 0,
          });
          await this.db.update(scrapeRuns).set({
            metadata: {
              scope: "bulk_via_category",
              items_scraped: itemsScraped,
              items_skipped_nodrift: itemsSkippedNoDrift,
              items_failed: itemsFailed,
              total_processed: itemsScraped + itemsSkippedNoDrift + itemsFailed,
              snapshots_inserted: snapshotsInserted,
              duration_ms: Date.now() - startTime,
              current_index: index,
              total_apps: totalApps,
              categories_fetched: fetchedCategories.size,
              category_failures: categoryFailures,
            },
          }).where(eq(scrapeRuns.id, run.id));
        }

        try {
          const hasRating = typeof card.averageRating === "number" && card.averageRating > 0;
          const hasCount = typeof card.ratingCount === "number" && card.ratingCount > 0;
          const extra = card.extra ?? {};
          const vendorName = (extra.vendorName ?? extra.companyName ?? extra.publisher) as string | undefined;
          const totalInstalls = (extra.totalInstalls ?? extra.installCount ?? extra.activeInstalls) as number | undefined;

          const [upserted] = await this.db
            .insert(apps)
            .values({
              platform: this.platform,
              slug,
              name: card.name,
              appCardSubtitle: card.shortDescription || undefined,
              ...(card.logoUrl && { iconUrl: card.logoUrl }),
              ...(hasRating && { averageRating: String(card.averageRating) }),
              ...(hasCount && { ratingCount: card.ratingCount }),
              ...(card.pricingHint && { pricingHint: card.pricingHint }),
              ...(card.externalId && { externalId: card.externalId }),
              ...(totalInstalls != null && { activeInstalls: totalInstalls }),
              ...(card.badges.length > 0 && { badges: card.badges }),
            })
            .onConflictDoUpdate({
              target: [apps.platform, apps.slug],
              set: {
                name: card.name,
                ...(card.shortDescription && { appCardSubtitle: card.shortDescription }),
                ...(card.logoUrl && { iconUrl: card.logoUrl }),
                ...(hasRating && { averageRating: String(card.averageRating) }),
                ...(hasCount && { ratingCount: card.ratingCount }),
                ...(card.pricingHint && { pricingHint: card.pricingHint }),
                ...(card.externalId && { externalId: card.externalId }),
                ...(totalInstalls != null && { activeInstalls: totalInstalls }),
                ...(card.badges.length > 0 && { badges: card.badges }),
                delistedAt: null,
                updatedAt: now,
              },
            })
            .returning({ id: apps.id });

          const result = await upsertSnapshotFromCategoryCard(this.db, upserted.id, card, {
            refresh,
            maxAgeMs,
            now,
            runId: run.id,
            vendorName,
          });
          if (result.inserted) {
            snapshotsInserted++;
            itemsScraped++;
          } else {
            itemsSkippedNoDrift++;
          }
        } catch (err) {
          itemsFailed++;
          log.warn("bulk_via_category: upsert failed", { slug, error: String(err) });
          await recordItemError(this.db, {
            scrapeRunId: run.id,
            itemIdentifier: slug,
            itemType: "app",
            error: err,
          });
        }
      }, this.configValue<number>("appDetailsConcurrencyBulk", 5));

      await this.db
        .update(scrapeRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          metadata: {
            scope: "bulk_via_category",
            items_scraped: itemsScraped,
            items_skipped_nodrift: itemsSkippedNoDrift,
            items_failed: itemsFailed,
            total_processed: itemsScraped + itemsSkippedNoDrift + itemsFailed,
            snapshots_inserted: snapshotsInserted,
            duration_ms: Date.now() - startTime,
            total_apps: totalApps,
            categories_fetched: fetchedCategories.size,
            category_failures: categoryFailures,
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
            scope: "bulk_via_category",
            items_scraped: itemsScraped,
            items_skipped_nodrift: itemsSkippedNoDrift,
            items_failed: itemsFailed,
            total_processed: itemsScraped + itemsSkippedNoDrift + itemsFailed,
            snapshots_inserted: snapshotsInserted,
            duration_ms: Date.now() - startTime,
            total_apps: totalApps,
            categories_fetched: fetchedCategories.size,
            category_failures: categoryFailures,
          },
        })
        .where(eq(scrapeRuns.id, run.id));
      throw error;
    }

    log.info("bulk_via_category: complete", {
      platform: this.platform,
      itemsScraped,
      itemsSkippedNoDrift,
      itemsFailed,
      snapshotsInserted,
      durationMs: Date.now() - startTime,
    });
  }

  /**
   * PLA-1051 — Selective full-detail enrichment.
   *
   * Runs the browser-based per-app scraper, but only for apps that actually
   * need full detail refresh: tracked apps, apps with empty/stale
   * `appSnapshots.appDetails`, newly-discovered apps (no snapshot yet), and a
   * rolling weekly cohort so every app is fully enriched at least once a week.
   *
   * The selection breakdown is emitted into `scrape_runs.metadata` for tuning.
   */
  async scrapeAllWithFullDetails(
    triggeredBy?: string,
    queue?: string,
    force?: boolean,
    opts: { staleDays?: number; cohortModulus?: number } = {},
  ): Promise<void> {
    const staleDays = opts.staleDays ?? 7;
    const cohortModulus = opts.cohortModulus ?? 7;

    const selection = await this.selectFullDetailCandidates({ staleDays, cohortModulus, now: new Date() });
    const total = selection.rows.length;

    if (total === 0) {
      log.info("all_with_full_details: no apps matched selection", { platform: this.platform });
      return;
    }

    log.info("all_with_full_details: selected apps for enrichment", {
      platform: this.platform,
      total,
      breakdown: selection.breakdown,
    });

    const parentRunIdFull = await resolveParentRunId(this.db, queue, this.jobId ? String(this.jobId) : null);
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
        parentRunId: parentRunIdFull,
        metadata: {
          scope: "all_with_full_details",
          selection_breakdown: selection.breakdown,
          total_apps: total,
        },
      })
      .returning();

    const startTime = Date.now();
    let itemsScraped = 0;
    let itemsSkippedFresh = 0;
    let itemsFailed = 0;
    const preFetched = await this.buildPreFetchedData(force);
    const selectedSlugs = selection.rows.map((r) => r.slug);

    try {
      await runConcurrent(selectedSlugs, async (slug, index) => {
        if (index % 25 === 0 || index === selectedSlugs.length - 1) {
          await this.db.update(scrapeRuns).set({
            metadata: {
              scope: "all_with_full_details",
              selection_breakdown: selection.breakdown,
              items_scraped: itemsScraped,
              items_skipped_fresh: itemsSkippedFresh,
              items_failed: itemsFailed,
              duration_ms: Date.now() - startTime,
              current_index: index,
              total_apps: total,
            },
          }).where(eq(scrapeRuns.id, run.id));
        }
        try {
          const outcome = await this.scrapeApp(slug, run.id, triggeredBy, undefined, force, preFetched);
          if (outcome === "skipped_fresh") itemsSkippedFresh++;
          else itemsScraped++;
        } catch (err) {
          if (err instanceof AppNotFoundError) {
            itemsScraped++;
          } else {
            itemsFailed++;
            await recordItemError(this.db, {
              scrapeRunId: run.id,
              itemIdentifier: slug,
              itemType: "app",
              error: err,
            });
          }
        }
      }, this.configValue(
        "appDetailsConcurrencyBulk",
        Math.min(this.configValue("appDetailsConcurrency", 3), 3),
      ));

      await this.db.update(scrapeRuns).set({
        status: "completed",
        completedAt: new Date(),
        metadata: {
          scope: "all_with_full_details",
          selection_breakdown: selection.breakdown,
          items_scraped: itemsScraped,
          items_skipped_fresh: itemsSkippedFresh,
          items_failed: itemsFailed,
          total_processed: itemsScraped + itemsSkippedFresh + itemsFailed,
          duration_ms: Date.now() - startTime,
          total_apps: total,
        },
      }).where(eq(scrapeRuns.id, run.id));
    } catch (err) {
      await this.db.update(scrapeRuns).set({
        status: "failed",
        completedAt: new Date(),
        error: String(err),
        metadata: {
          scope: "all_with_full_details",
          selection_breakdown: selection.breakdown,
          items_scraped: itemsScraped,
          items_skipped_fresh: itemsSkippedFresh,
          items_failed: itemsFailed,
          total_processed: itemsScraped + itemsSkippedFresh + itemsFailed,
          duration_ms: Date.now() - startTime,
          total_apps: total,
        },
      }).where(eq(scrapeRuns.id, run.id));
      throw err;
    }
  }

  /**
   * Identify which apps deserve the browser-based full-detail fetch. Exposed
   * for tests; also reused by scrapeAllWithFullDetails above. Returns the
   * deduped union of four selection predicates plus a per-bucket count.
   */
  async selectFullDetailCandidates(opts: {
    staleDays: number;
    cohortModulus: number;
    now: Date;
  }): Promise<{
    rows: Array<{ id: number; slug: string; reason: "tracked" | "new" | "stale" | "cohort" }>;
    breakdown: { tracked: number; new: number; stale: number; cohort: number; total: number };
  }> {
    const { staleDays, cohortModulus, now } = opts;

    const allRows = await this.db
      .select({
        id: apps.id,
        slug: apps.slug,
        isTracked: apps.isTracked,
        latestScrapedAt: sql<Date | null>`MAX(${appSnapshots.scrapedAt})`.as("latestScrapedAt"),
        latestAppDetailsLen: sql<number>`COALESCE(MAX(LENGTH(${appSnapshots.appDetails})), 0)`.as("latestAppDetailsLen"),
      })
      .from(apps)
      .leftJoin(appSnapshots, eq(apps.id, appSnapshots.appId))
      .where(eq(apps.platform, this.platform))
      .groupBy(apps.id, apps.slug, apps.isTracked);

    const cohortIndex = Math.floor(now.getTime() / (24 * 60 * 60 * 1000)) % Math.max(1, cohortModulus);
    const staleCutoff = now.getTime() - staleDays * 24 * 60 * 60 * 1000;

    const breakdown = { tracked: 0, new: 0, stale: 0, cohort: 0, total: 0 };
    const picked = new Map<number, { id: number; slug: string; reason: "tracked" | "new" | "stale" | "cohort" }>();

    for (const row of allRows) {
      let reason: "tracked" | "new" | "stale" | "cohort" | null = null;
      if (row.isTracked) {
        reason = "tracked";
        breakdown.tracked++;
      } else if (row.latestScrapedAt == null || row.latestAppDetailsLen === 0) {
        reason = "new";
        breakdown.new++;
      } else if (new Date(row.latestScrapedAt).getTime() < staleCutoff) {
        reason = "stale";
        breakdown.stale++;
      } else if (row.id % Math.max(1, cohortModulus) === cohortIndex) {
        reason = "cohort";
        breakdown.cohort++;
      }
      if (reason && !picked.has(row.id)) {
        picked.set(row.id, { id: row.id, slug: row.slug, reason });
      }
    }

    const rows = [...picked.values()];
    breakdown.total = rows.length;
    return { rows, breakdown };
  }

  /** Scrape a single app by slug */
  async scrapeApp(slug: string, runId?: string, triggeredBy?: string, queue?: string, force?: boolean, preFetched?: PreFetchedData): Promise<"scraped" | "skipped_fresh"> {
    log.info("scraping app", { slug, force });

    // Look up the app's integer ID — use pre-fetched data if available
    const existingApp = preFetched
      ? (preFetched.existingApps.get(slug) ?? undefined)
      : await this.db
          .select({ id: apps.id })
          .from(apps)
          .where(and(eq(apps.slug, slug), eq(apps.platform, this.platform)))
          .limit(1)
          .then((rows) => rows[0]);

    // Skip if already scraped within 12 hours (unless force=true)
    if (!force && existingApp) {
      if (preFetched) {
        const recentDate = preFetched.recentSnapshots.get(existingApp.id);
        if (recentDate) {
          const hoursSince = (Date.now() - recentDate.getTime()) / (1000 * 60 * 60);
          if (hoursSince < 12) {
            log.info("skipping recently scraped app", { slug, hoursSince: hoursSince.toFixed(1) });
            return "skipped_fresh";
          }
        }
      } else {
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
            return "skipped_fresh";
          }
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
      // Fetch app page using platform module if available.
      // HTTP 404 means the app was removed/delisted from the marketplace —
      // mark it in the apps table and throw AppNotFoundError so the batch caller
      // counts it as processed (not failed). Only Zoom throws AppNotFoundError
      // directly; for every other platform (Shopify et al.), the generic HTTP
      // fetch wrapper surfaces "HTTP 404" in the error message and we detect it here.
      let html: string;
      try {
        html = this.platformModule
          ? await this.platformModule.fetchAppPage(slug)
          : await this.httpClient.fetchPage(urls.app(slug));
      } catch (fetchErr) {
        if (fetchErr instanceof AppNotFoundError || is404Error(fetchErr)) {
          // Idempotent: preserve the original delisted_at if already set.
          await this.db
            .insert(apps)
            .values({
              platform: this.platform,
              slug,
              name: slug,
              delistedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [apps.platform, apps.slug],
              set: {
                delistedAt: sql`COALESCE(${apps.delistedAt}, NOW())`,
                updatedAt: new Date(),
              },
            });
          if (fetchErr instanceof AppNotFoundError) throw fetchErr;
          throw new AppNotFoundError(slug, this.platform, "HTTP 404");
        }
        throw fetchErr;
      }

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
                      : this.platform === "zoho"
                        ? (pd.tagline as string) || (pd.about as string) || ""
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
              demo_store_url: (this.platform === "wix" && pd.demoUrl && typeof pd.demoUrl === "string" ? pd.demoUrl : null) as string | null,
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
                : this.platform === "zoho" && pd.extensionId
                  ? String(pd.extensionId)
                  : null,
              _badges: normalized.badges,
            };
          })()
        : parseAppPage(html, slug);

      // Change detection: compare against current state
      const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];

      const currentApp = preFetched
        ? (preFetched.currentApps.get(slug) ?? undefined)
        : await this.db
            .select({ name: apps.name, currentVersion: apps.currentVersion })
            .from(apps)
            .where(and(eq(apps.slug, slug), eq(apps.platform, this.platform)))
            .then((rows) => rows[0]);

      if (currentApp && currentApp.name !== details.app_name) {
        changes.push({ field: "name", oldValue: currentApp.name, newValue: details.app_name });
      }

      // Version change detection (WordPress and other platforms with _currentVersion)
      const newVersion = ("_currentVersion" in details ? (details as any)._currentVersion : null) as string | null;
      if (currentApp && newVersion && currentApp.currentVersion && currentApp.currentVersion !== newVersion) {
        changes.push({ field: "currentVersion", oldValue: currentApp.currentVersion, newValue: newVersion });
      }

      // Get previous snapshot by app ID if we have one
      let prevSnapshot: PrevSnapshotData | undefined;

      if (existingApp) {
        prevSnapshot = preFetched
          ? preFetched.prevSnapshots.get(existingApp.id)
          : await this.db
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
              .limit(1)
              .then((rows) => rows[0]);
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
            // Guard: skip when new value is empty (scrape failure, not real change)
            if (!newVal) {
              log.warn("skipping false change: content→empty (likely scrape failure)", { slug, field });
              continue;
            }
            // Guard: skip boilerplate seoMetaDescription (scraper got shell page)
            if (field === "seoMetaDescription" && isBoilerplateMeta(newVal, this.platform)) {
              log.warn("skipping false change: boilerplate meta description", { slug, field, newVal });
              continue;
            }
            changes.push({ field, oldValue: oldVal, newValue: newVal });
          }
        }
        const oldFeatures = JSON.stringify(prevSnapshot.features);
        const newFeatures = JSON.stringify(details.features);
        // Skip when features were empty (first-time population)
        if (oldFeatures !== newFeatures && oldFeatures !== "[]") {
          // Guard: skip when new features are empty (scrape failure)
          if (newFeatures === "[]" || newFeatures === "null") {
            log.warn("skipping false change: features→empty (likely scrape failure)", { slug });
          } else {
            changes.push({ field: "features", oldValue: oldFeatures, newValue: newFeatures });
          }
        }

        const oldPlans = JSON.stringify((prevSnapshot.pricingPlans || []).map(normalizePlan));
        const newPlans = JSON.stringify((details.pricing_plans || []).map(normalizePlan));
        if (oldPlans !== newPlans && oldPlans !== "[]") {
          // Guard: skip when new plans are empty (scrape failure)
          if (newPlans === "[]" || newPlans === "null") {
            log.warn("skipping false change: pricingPlans→empty (likely scrape failure)", { slug });
          } else {
            changes.push({ field: "pricingPlans", oldValue: oldPlans, newValue: newPlans });
          }
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
          pricingModel: normalizePricingModel(details.pricing) || undefined,
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
            // Re-listed detection: clear delisted_at on any successful scrape.
            delistedAt: null,
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
        // Dedup: fetch only the most recent change per changed field (not all history)
        const changedFields = changes.map((c) => c.field);
        const latestChanges = await this.db
          .select({ field: appFieldChanges.field, newValue: appFieldChanges.newValue })
          .from(appFieldChanges)
          .where(and(
            eq(appFieldChanges.appId, appId),
            sql`${appFieldChanges.field} IN (${sql.join(changedFields.map((f) => sql`${f}`), sql`, `)})`,
          ))
          .orderBy(desc(appFieldChanges.detectedAt));

        // Build lookup: first occurrence per field = most recent value
        const latestByField = new Map<string, string | null>();
        for (const c of latestChanges) {
          if (!latestByField.has(c.field)) latestByField.set(c.field, c.newValue);
        }

        const dedupedChanges = changes.filter((c) => {
          const last = latestByField.get(c.field);
          return last === undefined || last !== c.newValue;
        });

        if (dedupedChanges.length > 0) {
          await this.db.insert(appFieldChanges).values(
            dedupedChanges.map((c) => ({
              appId,
              field: c.field,
              oldValue: c.oldValue,
              newValue: c.newValue,
              scrapeRunId: runId!,
            }))
          );
          log.info("detected field changes", { slug, fields: dedupedChanges.map((c) => c.field) });
        }
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

      // Extract screenshots from platformData (each platform stores them there)
      const rawScreenshots = (platformDataToStore as any)?.screenshots;
      const screenshots: string[] = Array.isArray(rawScreenshots)
        ? rawScreenshots
            .map((s: any) => (typeof s === "string" ? s : s?.src || s?.url || null))
            .filter((url: string | null): url is string => typeof url === "string" && url.startsWith("http"))
        : [];

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
        screenshots,
        platformData: platformDataToStore as Record<string, unknown>,
      });

      // Link developer to global developer profile (skip if already known from pre-fetch)
      if (details.developer?.name) {
        const devName = details.developer.name.trim();
        const alreadyLinked = preFetched && devName && preFetched.existingDevelopers.has(devName);
        if (!alreadyLinked) {
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
      }

      // Register category rankings from snapshot data
      if (resolvedCategories.length > 0) {
        // Shopify: batch ensure all categories exist in one query
        if (this.isShopify) {
          const catValues = resolvedCategories
            .map((cat) => {
              const slugMatch = cat.url.match(/\/categories\/([^/]+)/);
              if (!slugMatch) return null;
              return {
                platform: this.platform,
                slug: slugMatch[1],
                title: cat.title,
                url: cat.url || "",
                parentSlug: null as string | null,
                categoryLevel: 0,
                isTracked: false,
                isListingPage: true,
              };
            })
            .filter((v): v is NonNullable<typeof v> => v !== null);

          if (catValues.length > 0) {
            await this.db
              .insert(categories)
              .values(catValues)
              .onConflictDoNothing({ target: [categories.platform, categories.slug] });
          }
        }

        for (const cat of resolvedCategories) {
          let catSlug: string;
          if (this.isShopify) {
            const slugMatch = cat.url.match(/\/categories\/([^/]+)/);
            if (!slugMatch) continue;
            catSlug = slugMatch[1];
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
                })
                .onConflictDoNothing();
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
                })
                .onConflictDoNothing();
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

        // Batch upsert all similar apps at once
        const upsertedSimilarApps = await this.db
          .insert(apps)
          .values(similarApps.map((similar) => ({
            platform: this.platform,
            slug: similar.slug,
            name: similar.name,
            iconUrl: similar.icon_url || null,
          })))
          .onConflictDoUpdate({
            target: [apps.platform, apps.slug],
            set: {
              name: sql`excluded.name`,
              iconUrl: sql`excluded.icon_url`,
              updatedAt: new Date(),
            },
          })
          .returning({ id: apps.id, slug: apps.slug });

        // Build slug→id map for sighting inserts
        const similarIdMap = new Map<string, number>();
        for (const row of upsertedSimilarApps) {
          similarIdMap.set(row.slug, row.id);
        }

        // Batch upsert all sightings at once
        const sightingValues = similarApps
          .map((similar) => {
            const similarAppId = similarIdMap.get(similar.slug);
            if (!similarAppId) return null;
            return {
              appId,
              similarAppId,
              position: similar.position ?? null,
              seenDate: todayStr,
              firstSeenRunId: runId!,
              lastSeenRunId: runId!,
              timesSeenInDay: 1,
            };
          })
          .filter((v): v is NonNullable<typeof v> => v !== null);

        if (sightingValues.length > 0) {
          await this.db
            .insert(similarAppSightings)
            .values(sightingValues)
            .onConflictDoUpdate({
              target: [
                similarAppSightings.appId,
                similarAppSightings.similarAppId,
                similarAppSightings.seenDate,
              ],
              set: {
                lastSeenRunId: runId!,
                position: sql`excluded.position`,
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

    return "scraped";
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
