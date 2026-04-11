import { eq, sql, and, desc } from "drizzle-orm";
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
} from "@appranks/db";
import { urls, createLogger, type PlatformId } from "@appranks/shared";

const log = createLogger("keyword-scraper");
import { HttpClient } from "../http-client.js";
import { parseSearchPage } from "../parsers/search-parser.js";
import type { PlatformModule, NormalizedSearchApp } from "../platforms/platform-module.js";
import { runConcurrent } from "../utils/run-concurrent.js";
import { recordItemError } from "../utils/record-item-error.js";

export class KeywordScraper {
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

    const KEYWORD_TIMEOUT_MS = 180_000; // 180 seconds per keyword (increased from 90s to accommodate 10 pages + retries)
    const MAX_ITEMS_PROCESSED = 50;
    const itemsProcessed: { id: string; apps: number }[] = [];

    const currentlyProcessing = new Set<string>();

    try {
      await runConcurrent(keywords, async (kw, index) => {
        currentlyProcessing.add(kw.keyword);
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

    // Record organic rankings (position re-calculated excluding ads)
    for (let i = 0; i < organicApps.length; i++) {
      const app = organicApps[i];
      const newSubtitle = app.short_description || null;

      // Detect appCardSubtitle changes
      if (newSubtitle) {
        const [existing] = await this.db
          .select({ id: apps.id, appCardSubtitle: apps.appCardSubtitle })
          .from(apps)
          .where(and(eq(apps.slug, app.app_slug), eq(apps.platform, this.platform)));
        if (existing && existing.appCardSubtitle !== newSubtitle) {
          // Dedup: skip if the most recent change for this app+field already has the same new_value
          const [lastChange] = await this.db
            .select({ newValue: appFieldChanges.newValue })
            .from(appFieldChanges)
            .where(and(eq(appFieldChanges.appId, existing.id), eq(appFieldChanges.field, "appCardSubtitle")))
            .orderBy(desc(appFieldChanges.detectedAt))
            .limit(1);
          if (!lastChange || lastChange.newValue !== newSubtitle) {
            await this.db.insert(appFieldChanges).values({
              appId: existing.id,
              field: "appCardSubtitle",
              oldValue: existing.appCardSubtitle,
              newValue: newSubtitle,
              scrapeRunId: runId,
            });
          }
        }
      }

      // Only write rating/count if genuinely > 0 (0 means parser extraction failed)
      const hasRating = app.average_rating != null && app.average_rating > 0;
      const hasCount = app.rating_count != null && app.rating_count > 0;

      const [upsertedApp] = await this.db
        .insert(apps)
        .values({
          platform: this.platform,
          slug: app.app_slug,
          name: app.app_name,
          isBuiltForShopify: !!app.is_built_for_shopify,
          appCardSubtitle: app.short_description || undefined,
          ...(app.logo_url && { iconUrl: app.logo_url }),
          ...(hasRating && { averageRating: String(app.average_rating) }),
          ...(hasCount && { ratingCount: app.rating_count }),
          ...(app.pricing_hint && { pricingHint: app.pricing_hint }),
        })
        .onConflictDoUpdate({
          target: [apps.platform, apps.slug],
          set: {
            isBuiltForShopify: !!app.is_built_for_shopify,
            appCardSubtitle: app.short_description || undefined,
            ...(app.logo_url && { iconUrl: app.logo_url }),
            ...(hasRating && { averageRating: String(app.average_rating) }),
            ...(hasCount && { ratingCount: app.rating_count }),
            ...(app.pricing_hint && { pricingHint: app.pricing_hint }),
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
    }

    // Record null position for apps that dropped out of results.
    // Use the LATEST ranking per app (not just the previous run) to catch apps
    // that dropped multiple runs ago but never got a position:null recorded.
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

    const droppedApps = prevRows
      .filter((r) => !currentOrganicSlugs.has(r.app_slug));

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
      log.info("recorded dropped apps", { keyword, count: droppedApps.length, slugs: droppedApps.map((r) => r.app_slug) });
    }

    // Record ad sightings (upsert per app+keyword+day)
    // NOTE: Sponsored listings may show a different subtitle (e.g. "The app developer paid to promote...")
    // so we do NOT detect subtitle changes or update appCardSubtitle from sponsored results.
    for (const app of sponsoredApps) {
      const hasAdRating = app.average_rating != null && app.average_rating > 0;
      const hasAdCount = app.rating_count != null && app.rating_count > 0;

      const [upsertedApp] = await this.db
        .insert(apps)
        .values({
          platform: this.platform,
          slug: app.app_slug,
          name: app.app_name,
          isBuiltForShopify: !!app.is_built_for_shopify,
          ...(app.logo_url && { iconUrl: app.logo_url }),
          ...(hasAdRating && { averageRating: String(app.average_rating) }),
          ...(hasAdCount && { ratingCount: app.rating_count }),
          ...(app.pricing_hint && { pricingHint: app.pricing_hint }),
        })
        .onConflictDoUpdate({
          target: [apps.platform, apps.slug],
          set: {
            isBuiltForShopify: !!app.is_built_for_shopify,
            ...(app.logo_url && { iconUrl: app.logo_url }),
            ...(hasAdRating && { averageRating: String(app.average_rating) }),
            ...(hasAdCount && { ratingCount: app.rating_count }),
            ...(app.pricing_hint && { pricingHint: app.pricing_hint }),
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
