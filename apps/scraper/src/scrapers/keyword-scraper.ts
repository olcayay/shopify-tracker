import { eq, sql, and, desc, inArray } from "drizzle-orm";
import type { Database } from "@appranks/db";
import {
  scrapeRuns,
  trackedKeywords,
  keywordSnapshots,
  apps,
  appSnapshots,
  appKeywordRankings,
  keywordAdSightings,
  appFieldChanges,
  sqlArray,
} from "@appranks/db";
import { urls, createLogger, type PlatformId } from "@appranks/shared";

const log = createLogger("keyword-scraper");
import { HttpClient } from "../http-client.js";
import { parseSearchPage } from "../parsers/search-parser.js";
import type { PlatformModule, NormalizedSearchApp } from "../platforms/platform-module.js";
import { runConcurrent } from "../utils/run-concurrent.js";
import { recordItemError } from "../utils/record-item-error.js";

/** Retry a DB operation on deadlock (up to 3 attempts with jittered backoff) */
async function withDeadlockRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt < 3 && err?.message?.includes("deadlock detected")) {
        const jitter = Math.random() * 200 * attempt;
        log.warn("deadlock detected, retrying", { label, attempt, jitterMs: Math.round(jitter) });
        await new Promise(r => setTimeout(r, jitter));
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

export class KeywordScraper {
  private db: Database;
  private httpClient: HttpClient;
  private platform: PlatformId;
  private platformModule?: PlatformModule;
  public jobId?: string;
  /** Resolved runtime config (code defaults + DB overrides). Set by process-job.ts. */
  public resolvedConfig?: import("../config-resolver.js").ResolvedScraperConfig;

  /** Read a config value with priority: resolved (DB) → platform constants → fallback. */
  private configValue<T>(key: string, fallback: T): T {
    const read = (src: unknown, path: string): unknown => {
      if (!src || typeof src !== "object") return undefined;
      let cursor: any = src;
      for (const part of path.split(".")) {
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

  /** Scrape search results for all active keywords */
  async scrapeAll(triggeredBy?: string, pageOptions?: { pages?: "first" | "all" | number }, queue?: string): Promise<string[]> {
    const keywords = await this.db
      .select()
      .from(trackedKeywords)
      .where(and(eq(trackedKeywords.isActive, true), eq(trackedKeywords.platform, this.platform)));

    if (keywords.length === 0) {
      log.info("no active keywords found");
      return [];
    }

    log.info("scraping tracked keywords", { count: keywords.length });

    const [run] = await this.db
      .insert(scrapeRuns)
      .values({
        scraperType: "keyword_search",
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
    const allDiscoveredSlugs = new Set<string>();
    let itemsScraped = 0;
    let itemsFailed = 0;

    const KEYWORD_TIMEOUT_MS = 90_000; // 90 seconds per keyword (batch DB + sequential 10 pages typically takes 15-30s)
    const MAX_ITEMS_PROCESSED = 50;
    const itemsProcessed: { id: string; apps: number }[] = [];

    const currentlyProcessing = new Set<string>();

    try {
      await runConcurrent(keywords, async (kw, index) => {
        currentlyProcessing.add(kw.keyword);
        // Update metadata every 5 keywords to reduce DB overhead
        if (index % 5 === 0) {
          await this.db.update(scrapeRuns).set({
            metadata: {
              items_scraped: itemsScraped,
              items_failed: itemsFailed,
              duration_ms: Date.now() - startTime,
              currently_processing: [...currentlyProcessing],
              current_index: index,
              total_keywords: keywords.length,
              items_processed: itemsProcessed.slice(0, MAX_ITEMS_PROCESSED),
            },
          }).where(eq(scrapeRuns.id, run.id));
        }

        const kwStart = Date.now();
        try {
          const slugs = await Promise.race([
            this.scrapeKeyword(kw.id, kw.keyword, run.id, pageOptions),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`keyword scrape timed out after ${KEYWORD_TIMEOUT_MS / 1000}s`)), KEYWORD_TIMEOUT_MS)
            ),
          ]);
          for (const s of slugs) allDiscoveredSlugs.add(s);
          itemsScraped++;
          if (itemsProcessed.length < MAX_ITEMS_PROCESSED) {
            itemsProcessed.push({ id: kw.keyword, apps: slugs.length });
          }
          log.info("keyword:scraped", { keyword: kw.keyword, durationMs: Date.now() - kwStart, apps: slugs.length });
        } catch (error) {
          log.error("keyword:failed", { keyword: kw.keyword, durationMs: Date.now() - kwStart, error: String(error) });
          itemsFailed++;
          await recordItemError(this.db, {
            scrapeRunId: run.id,
            itemIdentifier: kw.keyword,
            itemType: "keyword",
            url: this.platformModule ? undefined : urls.search(kw.keyword),
            error,
          });
        } finally {
          currentlyProcessing.delete(kw.keyword);
        }
      }, this.configValue("keywordConcurrency", 3));

      await this.db
        .update(scrapeRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          metadata: {
            items_scraped: itemsScraped,
            items_failed: itemsFailed,
            duration_ms: Date.now() - startTime,
            items_processed: itemsProcessed.slice(0, MAX_ITEMS_PROCESSED),
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
            items_processed: itemsProcessed.slice(0, MAX_ITEMS_PROCESSED),
          },
        })
        .where(eq(scrapeRuns.id, run.id));
      throw error;
    } finally {
      // Clean up browser if the platform module has one (e.g. Canva)
      // Must be in finally to prevent process from hanging on error paths
      if (this.platformModule && "closeBrowser" in this.platformModule && typeof (this.platformModule as any).closeBrowser === "function") {
        await (this.platformModule as any).closeBrowser().catch((e: unknown) => log.warn("failed to close browser", { error: String(e) }));
      }
    }

    log.info("scraping complete", { itemsScraped, itemsFailed, discoveredApps: allDiscoveredSlugs.size, durationMs: Date.now() - startTime });
    return [...allDiscoveredSlugs];
  }

  private get isSmokeTest(): boolean {
    return process.env.SMOKE_TEST === "1";
  }

  /** Scrape search results for a single keyword */
  async scrapeKeyword(
    keywordId: number,
    keyword: string,
    runId: string,
    pageOptions?: { pages?: "first" | "all" | number }
  ): Promise<string[]> {
    const kwStart = Date.now();
    log.info("scraping keyword", { keyword, platform: this.platform, pages: pageOptions?.pages ?? "default" });

    // Use generic path for non-Shopify platforms
    if (this.platformModule && !this.isShopify) {
      return this.scrapeKeywordGeneric(keywordId, keyword, runId, pageOptions);
    }

    const MAX_PAGES = pageOptions?.pages === "first" ? 1
      : pageOptions?.pages === "all" ? 20
      : typeof pageOptions?.pages === "number" ? pageOptions.pages
      : 10;
    const allApps: import("@appranks/shared").KeywordSearchApp[] = [];
    const seenSponsoredSlugs = new Set<string>();
    const seenOrganicSlugs = new Set<string>();
    let totalResults: number | null = null;
    let organicCount = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const pageStart = Date.now();
      const searchUrl = urls.search(keyword, page);
      const html = await this.httpClient.fetchPage(searchUrl, {
        "Turbo-Frame": "search_page",
      });
      const data = parseSearchPage(html, keyword, page, organicCount);
      log.info("keyword:page_fetched", { keyword, page, pageMs: Date.now() - pageStart, apps: data.apps.length, hasNext: data.has_next_page });

      if (page === 1) totalResults = data.total_results;

      // Deduplicate across pages, per type (same app can be both sponsored and organic)
      for (const app of data.apps) {
        if (app.is_sponsored) {
          if (seenSponsoredSlugs.has(app.app_slug)) continue;
          seenSponsoredSlugs.add(app.app_slug);
        } else {
          if (seenOrganicSlugs.has(app.app_slug)) continue;
          seenOrganicSlugs.add(app.app_slug);
          if (!app.is_built_in) organicCount++;
        }
        allApps.push(app);
      }

      if (!data.has_next_page) {
        log.info("no more pages", { keyword, stoppedAtPage: page });
        break;
      }
    }

    const fetchMs = Date.now() - kwStart;
    log.info("keyword:fetch_done", { keyword, fetchMs, totalApps: allApps.length, organicCount });

    // In smoke test mode, skip DB writes
    if (this.isSmokeTest) {
      log.info("keyword:complete", { keyword, totalApps: allApps.length, totalMs: Date.now() - kwStart });
      return [...new Set(allApps.filter((a) => !a.is_sponsored && !a.is_built_in).map((a) => a.app_slug))];
    }

    // Insert keyword snapshot (keeps all results including sponsored)
    await this.db.insert(keywordSnapshots).values({
      keywordId,
      scrapeRunId: runId,
      scrapedAt: new Date(),
      totalResults,
      results: allApps,
    });

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // Separate organic, sponsored, and built-in
    const organicApps = allApps.filter((a) => !a.is_sponsored && !a.is_built_in);
    const sponsoredApps = allApps.filter((a) => a.is_sponsored);

    // --- Batch subtitle change detection ---
    const subtitleCandidates = organicApps.filter(a => {
      const sub = a.short_description || null;
      return sub && sub.toLowerCase() !== a.app_name.toLowerCase();
    });
    if (subtitleCandidates.length > 0) {
      const candidateSlugs = subtitleCandidates.map(a => a.app_slug);
      const existingApps = await this.db
        .select({ id: apps.id, slug: apps.slug, appCardSubtitle: apps.appCardSubtitle, name: apps.name })
        .from(apps)
        .where(and(eq(apps.platform, this.platform), inArray(apps.slug, candidateSlugs)));
      const existingMap = new Map(existingApps.map(a => [a.slug, a]));

      // Batch fetch last field changes for all candidate apps
      const existingIds = existingApps.map(a => a.id);
      const lastChangesMap = new Map<number, string | null>();
      if (existingIds.length > 0) {
        const lastChanges = await this.db.execute(sql`
          SELECT DISTINCT ON (app_id) app_id, new_value
          FROM app_field_changes
          WHERE app_id = ANY(${sqlArray(existingIds)}) AND field = 'appCardSubtitle'
          ORDER BY app_id, detected_at DESC
        `);
        const rows: { app_id: number; new_value: string | null }[] = (lastChanges as any).rows ?? lastChanges;
        for (const r of rows) lastChangesMap.set(r.app_id, r.new_value);
      }

      // Collect field changes to batch insert
      const fieldChangeValues: { appId: number; field: string; oldValue: string | null; newValue: string | null; scrapeRunId: string }[] = [];
      for (const app of subtitleCandidates) {
        const newSubtitle = app.short_description || null;
        const existing = existingMap.get(app.app_slug);
        if (!existing) continue;
        if (existing.appCardSubtitle === newSubtitle) continue;
        if (existing.name?.toLowerCase() === newSubtitle?.toLowerCase()) continue;
        const lastChangeValue = lastChangesMap.get(existing.id);
        if (lastChangeValue === newSubtitle) continue;
        fieldChangeValues.push({
          appId: existing.id, field: "appCardSubtitle",
          oldValue: existing.appCardSubtitle, newValue: newSubtitle, scrapeRunId: runId,
        });
      }
      if (fieldChangeValues.length > 0) {
        for (let c = 0; c < fieldChangeValues.length; c += 100) {
          await this.db.insert(appFieldChanges).values(fieldChangeValues.slice(c, c + 100));
        }
      }
    }

    // --- Batch upsert all organic apps ---
    const slugToIdMap = new Map<string, number>();
    if (organicApps.length > 0) {
      for (let c = 0; c < organicApps.length; c += 100) {
        const chunk = organicApps.slice(c, c + 100);
        const upserted = await withDeadlockRetry(() => this.db
          .insert(apps)
          .values(chunk.map(app => ({
            platform: this.platform,
            slug: app.app_slug,
            name: app.app_name,
            isBuiltForShopify: !!app.is_built_for_shopify,
            appCardSubtitle: app.short_description || null,
            iconUrl: app.logo_url || null,
            averageRating: app.average_rating != null && app.average_rating > 0 ? String(app.average_rating) : null,
            ratingCount: app.rating_count != null && app.rating_count > 0 ? app.rating_count : null,
            pricingHint: app.pricing_hint || null,
          })))
          .onConflictDoUpdate({
            target: [apps.platform, apps.slug],
            set: {
              isBuiltForShopify: sql`excluded.is_built_for_shopify`,
              appCardSubtitle: sql`excluded.app_card_subtitle`,
              iconUrl: sql`COALESCE(excluded.icon_url, ${apps.iconUrl})`,
              averageRating: sql`COALESCE(excluded.average_rating, ${apps.averageRating})`,
              ratingCount: sql`COALESCE(excluded.rating_count, ${apps.ratingCount})`,
              pricingHint: sql`COALESCE(excluded.pricing_hint, ${apps.pricingHint})`,
            },
          })
          .returning({ id: apps.id, slug: apps.slug }), "organic-apps-upsert");
        for (const r of upserted) slugToIdMap.set(r.slug, r.id);
      }
    }

    // --- Batch insert organic rankings ---
    const rankingValues: { appId: number; keywordId: number; scrapeRunId: string; scrapedAt: Date; position: number }[] = [];
    for (let i = 0; i < organicApps.length; i++) {
      const appId = slugToIdMap.get(organicApps[i].app_slug);
      if (appId) rankingValues.push({ appId, keywordId, scrapeRunId: runId, scrapedAt: now, position: i + 1 });
    }
    for (let c = 0; c < rankingValues.length; c += 100) {
      await this.db.insert(appKeywordRankings).values(rankingValues.slice(c, c + 100)).onConflictDoNothing();
    }

    // --- Record dropped apps (batch) ---
    const currentOrganicSlugs = new Set(organicApps.map((a) => a.app_slug));
    const previouslyRanked = await this.db.execute(sql`
      SELECT a.id AS app_id, a.slug AS app_slug FROM (
        SELECT DISTINCT ON (app_id) app_id, position
        FROM app_keyword_rankings
        WHERE keyword_id = ${keywordId}
          AND scrape_run_id != ${runId}
        ORDER BY app_id, scraped_at DESC
      ) latest
      JOIN apps a ON a.id = latest.app_id
      WHERE latest.position IS NOT NULL
    `);
    const prevRows: { app_id: number; app_slug: string }[] = (previouslyRanked as any).rows ?? previouslyRanked;
    const droppedApps = prevRows.filter((r) => !currentOrganicSlugs.has(r.app_slug));

    if (droppedApps.length > 0) {
      const droppedValues = droppedApps.map(d => ({
        appId: d.app_id, keywordId, scrapeRunId: runId, scrapedAt: now, position: null as number | null,
      }));
      for (let c = 0; c < droppedValues.length; c += 100) {
        await this.db.insert(appKeywordRankings).values(droppedValues.slice(c, c + 100)).onConflictDoNothing();
      }
      log.info("recorded dropped apps", { keyword, count: droppedApps.length, slugs: droppedApps.map((r) => r.app_slug) });
    }

    // --- Batch upsert sponsored apps + ad sightings ---
    if (sponsoredApps.length > 0) {
      for (let c = 0; c < sponsoredApps.length; c += 100) {
        const chunk = sponsoredApps.slice(c, c + 100);
        const upserted = await withDeadlockRetry(() => this.db
          .insert(apps)
          .values(chunk.map(app => ({
            platform: this.platform,
            slug: app.app_slug,
            name: app.app_name,
            isBuiltForShopify: !!app.is_built_for_shopify,
            iconUrl: app.logo_url || null,
            averageRating: app.average_rating != null && app.average_rating > 0 ? String(app.average_rating) : null,
            ratingCount: app.rating_count != null && app.rating_count > 0 ? app.rating_count : null,
            pricingHint: app.pricing_hint || null,
          })))
          .onConflictDoUpdate({
            target: [apps.platform, apps.slug],
            set: {
              isBuiltForShopify: sql`excluded.is_built_for_shopify`,
              iconUrl: sql`COALESCE(excluded.icon_url, ${apps.iconUrl})`,
              averageRating: sql`COALESCE(excluded.average_rating, ${apps.averageRating})`,
              ratingCount: sql`COALESCE(excluded.rating_count, ${apps.ratingCount})`,
              pricingHint: sql`COALESCE(excluded.pricing_hint, ${apps.pricingHint})`,
            },
          })
          .returning({ id: apps.id, slug: apps.slug }), "sponsored-apps-upsert");
        for (const r of upserted) slugToIdMap.set(r.slug, r.id);
      }

      // Batch insert ad sightings
      const adValues = sponsoredApps.map(app => {
        const appId = slugToIdMap.get(app.app_slug);
        if (!appId) return null;
        return { appId, keywordId, seenDate: todayStr, firstSeenRunId: runId, lastSeenRunId: runId, timesSeenInDay: 1 };
      }).filter((v): v is NonNullable<typeof v> => v !== null);

      for (let c = 0; c < adValues.length; c += 100) {
        await this.db
          .insert(keywordAdSightings)
          .values(adValues.slice(c, c + 100))
          .onConflictDoUpdate({
            target: [keywordAdSightings.appId, keywordAdSightings.keywordId, keywordAdSightings.seenDate],
            set: {
              lastSeenRunId: sql`${runId}`,
              timesSeenInDay: sql`${keywordAdSightings.timesSeenInDay} + 1`,
            },
          });
      }
    }

    // Return unique organic app slugs
    return [...new Set(organicApps.map((a) => a.app_slug))];
  }

  /**
   * Generic keyword scraping using PlatformModule interface.
   * Used for non-Shopify platforms (Salesforce, etc.)
   */
  private async scrapeKeywordGeneric(
    keywordId: number,
    keyword: string,
    runId: string,
    pageOptions?: { pages?: "first" | "all" | number }
  ): Promise<string[]> {
    const kwStart = Date.now();
    const mod = this.platformModule!;

    const MAX_PAGES = pageOptions?.pages === "first" ? 1
      : pageOptions?.pages === "all" ? 20
      : typeof pageOptions?.pages === "number" ? pageOptions.pages
      : 10;

    const allNormalizedApps: NormalizedSearchApp[] = [];
    const seenSponsoredSlugs = new Set<string>();
    const seenOrganicSlugs = new Set<string>();
    let totalResults: number | null = null;
    let organicCount = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const pageStart = Date.now();
      const json = await mod.fetchSearchPage!(keyword, page);
      if (!json) break;

      const data = mod.parseSearchPage!(json, keyword, page, organicCount);
      log.info("keyword:page_fetched", { keyword, platform: this.platform, page, pageMs: Date.now() - pageStart, apps: data.apps.length, hasNext: data.hasNextPage });
      if (page === 1) totalResults = data.totalResults;

      for (const app of data.apps) {
        if (app.isSponsored) {
          if (seenSponsoredSlugs.has(app.appSlug)) continue;
          seenSponsoredSlugs.add(app.appSlug);
        } else {
          if (seenOrganicSlugs.has(app.appSlug)) continue;
          seenOrganicSlugs.add(app.appSlug);
          organicCount++;
        }
        allNormalizedApps.push(app);
      }

      if (!data.hasNextPage) {
        log.info("no more pages", { keyword, stoppedAtPage: page });
        break;
      }
    }

    const fetchMs = Date.now() - kwStart;
    log.info("keyword:fetch_done", { keyword, platform: this.platform, fetchMs, totalApps: allNormalizedApps.length, organicCount });

    // In smoke test mode, skip DB writes
    if (this.isSmokeTest) {
      log.info("keyword:complete", { keyword, platform: this.platform, totalApps: allNormalizedApps.length, totalMs: Date.now() - kwStart });
      return [...new Set(allNormalizedApps.filter((a) => !a.isSponsored).map((a) => a.appSlug))];
    }

    // Convert to snapshot format (KeywordSearchApp)
    const snapshotResults = allNormalizedApps.map((app) => ({
      app_slug: app.appSlug,
      app_name: app.appName,
      app_url: mod.buildAppUrl(app.appSlug),
      short_description: app.shortDescription,
      average_rating: app.averageRating,
      rating_count: app.ratingCount,
      logo_url: app.logoUrl,
      pricing_hint: app.pricingHint || undefined,
      is_sponsored: app.isSponsored,
      is_built_for_shopify: false,
      is_built_in: false,
      position: app.position,
      badges: app.badges,
    }));

    await this.db.insert(keywordSnapshots).values({
      keywordId,
      scrapeRunId: runId,
      scrapedAt: new Date(),
      totalResults,
      results: snapshotResults,
    });

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const organicApps = allNormalizedApps.filter((a) => !a.isSponsored);
    const sponsoredApps = allNormalizedApps.filter((a) => a.isSponsored);

    // Record organic rankings
    for (let i = 0; i < organicApps.length; i++) {
      const app = organicApps[i];
      const hasRating = app.averageRating > 0;
      const hasCount = app.ratingCount > 0;

      // Extract extra metadata from listing (Atlassian: vendorName, totalInstalls, externalId)
      const extra = app.extra || {};
      const totalInstalls = (extra.totalInstalls ?? extra.installCount ?? extra.activeInstalls) as number | undefined;
      const vendorName = (extra.vendorName ?? extra.companyName) as string | undefined;
      const externalId = extra.externalId as string | undefined;

      const [upsertedApp] = await this.db
        .insert(apps)
        .values({
          platform: this.platform,
          slug: app.appSlug,
          name: app.appName,
          appCardSubtitle: app.shortDescription || undefined,
          ...(app.logoUrl && { iconUrl: app.logoUrl }),
          ...(hasRating && { averageRating: String(app.averageRating) }),
          ...(hasCount && { ratingCount: app.ratingCount }),
          ...(app.pricingHint && { pricingHint: app.pricingHint }),
          ...(externalId && { externalId }),
          ...(totalInstalls != null && { activeInstalls: totalInstalls }),
          ...(app.badges.length > 0 && { badges: app.badges }),
        })
        .onConflictDoUpdate({
          target: [apps.platform, apps.slug],
          set: {
            appCardSubtitle: app.shortDescription || undefined,
            ...(app.logoUrl && { iconUrl: app.logoUrl }),
            ...(hasRating && { averageRating: String(app.averageRating) }),
            ...(hasCount && { ratingCount: app.ratingCount }),
            ...(app.pricingHint && { pricingHint: app.pricingHint }),
            ...(externalId && { externalId }),
            ...(totalInstalls != null && { activeInstalls: totalInstalls }),
            ...(app.badges.length > 0 && { badges: app.badges }),
          },
        })
        .returning({ id: apps.id });

      await this.db.insert(appKeywordRankings).values({
        appId: upsertedApp.id,
        keywordId,
        scrapeRunId: runId,
        scrapedAt: now,
        position: i + 1,
      }).onConflictDoNothing();

      // For non-Shopify platforms: ensure a minimal snapshot exists so dashboard can show rating/pricing/developer
      const hasDescription = !!app.shortDescription;
      if (this.platform !== "shopify" && (hasRating || hasCount || vendorName || hasDescription || app.badges.length > 0 || (totalInstalls != null && totalInstalls > 0))) {
        const [existingSnap] = await this.db
          .select({ id: appSnapshots.id })
          .from(appSnapshots)
          .where(eq(appSnapshots.appId, upsertedApp.id))
          .limit(1);
        if (!existingSnap) {
          await this.db.insert(appSnapshots).values({
            appId: upsertedApp.id,
            scrapeRunId: runId,
            scrapedAt: now,
            averageRating: hasRating ? String(app.averageRating) : null,
            ratingCount: hasCount ? app.ratingCount : null,
            pricing: app.pricingHint || "",
            appIntroduction: app.shortDescription || "",
            appDetails: "",
            seoTitle: "",
            seoMetaDescription: "",
            features: [],
            developer: vendorName ? { name: vendorName, url: "" } : null,
            demoStoreUrl: null,
            languages: [],
            integrations: [],
            categories: [],
            pricingPlans: [],
            support: null,
          });
        }
      }
    }

    // Record dropped apps
    const currentOrganicSlugs = new Set(organicApps.map((a) => a.appSlug));
    const previouslyRanked = await this.db.execute(sql`
      SELECT a.id AS app_id, a.slug AS app_slug FROM (
        SELECT DISTINCT ON (app_id) app_id, position
        FROM app_keyword_rankings
        WHERE keyword_id = ${keywordId}
          AND scrape_run_id != ${runId}
        ORDER BY app_id, scraped_at DESC
      ) latest
      JOIN apps a ON a.id = latest.app_id
      WHERE latest.position IS NOT NULL
    `);
    const prevRows: { app_id: number; app_slug: string }[] = (previouslyRanked as any).rows ?? previouslyRanked;
    const droppedApps = prevRows.filter((r) => !currentOrganicSlugs.has(r.app_slug));

    for (const dropped of droppedApps) {
      await this.db.insert(appKeywordRankings).values({
        appId: dropped.app_id,
        keywordId,
        scrapeRunId: runId,
        scrapedAt: now,
        position: null,
      }).onConflictDoNothing();
    }

    if (droppedApps.length > 0) {
      log.info("recorded dropped apps", { keyword, count: droppedApps.length });
    }

    // Record ad sightings
    for (const app of sponsoredApps) {
      const hasRating = app.averageRating > 0;
      const hasCount = app.ratingCount > 0;
      const extra = app.extra || {};
      const totalInstalls = extra.totalInstalls as number | undefined;
      const externalId = extra.externalId as string | undefined;

      const [upsertedApp] = await this.db
        .insert(apps)
        .values({
          platform: this.platform,
          slug: app.appSlug,
          name: app.appName,
          ...(app.logoUrl && { iconUrl: app.logoUrl }),
          ...(hasRating && { averageRating: String(app.averageRating) }),
          ...(hasCount && { ratingCount: app.ratingCount }),
          ...(app.pricingHint && { pricingHint: app.pricingHint }),
          ...(externalId && { externalId }),
          ...(totalInstalls != null && { activeInstalls: totalInstalls }),
          ...(app.badges.length > 0 && { badges: app.badges }),
        })
        .onConflictDoUpdate({
          target: [apps.platform, apps.slug],
          set: {
            ...(app.logoUrl && { iconUrl: app.logoUrl }),
            ...(hasRating && { averageRating: String(app.averageRating) }),
            ...(hasCount && { ratingCount: app.ratingCount }),
            ...(app.pricingHint && { pricingHint: app.pricingHint }),
            ...(externalId && { externalId }),
            ...(totalInstalls != null && { activeInstalls: totalInstalls }),
            ...(app.badges.length > 0 && { badges: app.badges }),
          },
        })
        .returning({ id: apps.id });

      await this.db
        .insert(keywordAdSightings)
        .values({
          appId: upsertedApp.id,
          keywordId,
          seenDate: todayStr,
          firstSeenRunId: runId,
          lastSeenRunId: runId,
          timesSeenInDay: 1,
        })
        .onConflictDoUpdate({
          target: [
            keywordAdSightings.appId,
            keywordAdSightings.keywordId,
            keywordAdSightings.seenDate,
          ],
          set: {
            lastSeenRunId: sql`${runId}`,
            timesSeenInDay: sql`${keywordAdSightings.timesSeenInDay} + 1`,
          },
        });
    }

    return [...new Set(organicApps.map((a) => a.appSlug))];
  }
}
