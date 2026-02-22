import { eq, sql, and } from "drizzle-orm";
import type { Database } from "@shopify-tracking/db";
import {
  scrapeRuns,
  trackedKeywords,
  keywordSnapshots,
  apps,
  appKeywordRankings,
  keywordAdSightings,
  appFieldChanges,
} from "@shopify-tracking/db";
import { urls, createLogger } from "@shopify-tracking/shared";

const log = createLogger("keyword-scraper");
import { HttpClient } from "../http-client.js";
import { parseSearchPage } from "../parsers/search-parser.js";

export class KeywordScraper {
  private db: Database;
  private httpClient: HttpClient;

  constructor(db: Database, httpClient?: HttpClient) {
    this.db = db;
    this.httpClient = httpClient || new HttpClient();
  }

  /** Scrape search results for all active keywords */
  async scrapeAll(triggeredBy?: string, pageOptions?: { pages?: "first" | "all" | number }): Promise<string[]> {
    const keywords = await this.db
      .select()
      .from(trackedKeywords)
      .where(eq(trackedKeywords.isActive, true));

    if (keywords.length === 0) {
      log.info("no active keywords found");
      return [];
    }

    log.info("scraping tracked keywords", { count: keywords.length });

    const [run] = await this.db
      .insert(scrapeRuns)
      .values({
        scraperType: "keyword_search",
        status: "running",
        createdAt: new Date(),
        startedAt: new Date(),
        triggeredBy,
      })
      .returning();

    const startTime = Date.now();
    const allDiscoveredSlugs = new Set<string>();
    let itemsScraped = 0;
    let itemsFailed = 0;

    for (const kw of keywords) {
      try {
        const slugs = await this.scrapeKeyword(kw.id, kw.keyword, run.id, pageOptions);
        for (const s of slugs) allDiscoveredSlugs.add(s);
        itemsScraped++;
      } catch (error) {
        log.error("failed to scrape keyword", { keyword: kw.keyword, error: String(error) });
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

    log.info("scraping complete", { itemsScraped, itemsFailed, discoveredApps: allDiscoveredSlugs.size, durationMs: Date.now() - startTime });
    return [...allDiscoveredSlugs];
  }

  /** Scrape search results for a single keyword */
  async scrapeKeyword(
    keywordId: number,
    keyword: string,
    runId: string,
    pageOptions?: { pages?: "first" | "all" | number }
  ): Promise<string[]> {
    log.info("scraping keyword", { keyword });

    const MAX_PAGES = pageOptions?.pages === "first" ? 1
      : pageOptions?.pages === "all" ? 20
      : typeof pageOptions?.pages === "number" ? pageOptions.pages
      : 4;
    const allApps: import("@shopify-tracking/shared").KeywordSearchApp[] = [];
    const seenSponsoredSlugs = new Set<string>();
    const seenOrganicSlugs = new Set<string>();
    let totalResults: number | null = null;
    let organicCount = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const searchUrl = urls.search(keyword, page);
      const html = await this.httpClient.fetchPage(searchUrl, {
        "Turbo-Frame": "search_page",
      });
      const data = parseSearchPage(html, keyword, page, organicCount);

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

    log.info("keyword pages scraped", { keyword, totalApps: allApps.length, organicCount });

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
          .select({ appCardSubtitle: apps.appCardSubtitle })
          .from(apps)
          .where(eq(apps.slug, app.app_slug));
        if (existing && existing.appCardSubtitle !== newSubtitle) {
          await this.db.insert(appFieldChanges).values({
            appSlug: app.app_slug,
            field: "appCardSubtitle",
            oldValue: existing.appCardSubtitle,
            newValue: newSubtitle,
            scrapeRunId: runId,
          });
        }
      }

      // Only write rating/count if genuinely > 0 (0 means parser extraction failed)
      const hasRating = app.average_rating != null && app.average_rating > 0;
      const hasCount = app.rating_count != null && app.rating_count > 0;

      await this.db
        .insert(apps)
        .values({
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
          target: apps.slug,
          set: {
            isBuiltForShopify: !!app.is_built_for_shopify,
            appCardSubtitle: app.short_description || undefined,
            ...(app.logo_url && { iconUrl: sql`COALESCE(${apps.iconUrl}, ${app.logo_url})` }),
            ...(hasRating && { averageRating: String(app.average_rating) }),
            ...(hasCount && { ratingCount: app.rating_count }),
            ...(app.pricing_hint && { pricingHint: app.pricing_hint }),
          },
        });

      await this.db.insert(appKeywordRankings).values({
        appSlug: app.app_slug,
        keywordId,
        scrapeRunId: runId,
        scrapedAt: now,
        position: i + 1,
      });
    }

    // Record null position for apps that dropped out of results.
    // Use the LATEST ranking per app (not just the previous run) to catch apps
    // that dropped multiple runs ago but never got a position:null recorded.
    const currentOrganicSlugs = new Set(organicApps.map((a) => a.app_slug));

    const previouslyRanked = await this.db.execute(sql`
      SELECT app_slug FROM (
        SELECT DISTINCT ON (app_slug) app_slug, position
        FROM app_keyword_rankings
        WHERE keyword_id = ${keywordId}
          AND scrape_run_id != ${runId}
        ORDER BY app_slug, scraped_at DESC
      ) latest
      WHERE position IS NOT NULL
    `);
    const prevRows: { app_slug: string }[] = (previouslyRanked as any).rows ?? previouslyRanked;

    const droppedSlugs = prevRows
      .map((r) => r.app_slug)
      .filter((slug) => !currentOrganicSlugs.has(slug));

    for (const slug of droppedSlugs) {
      await this.db.insert(appKeywordRankings).values({
        appSlug: slug,
        keywordId,
        scrapeRunId: runId,
        scrapedAt: now,
        position: null,
      });
    }

    if (droppedSlugs.length > 0) {
      log.info("recorded dropped apps", { keyword, count: droppedSlugs.length, slugs: droppedSlugs });
    }

    // Record ad sightings (upsert per app+keyword+day)
    // NOTE: Sponsored listings may show a different subtitle (e.g. "The app developer paid to promote...")
    // so we do NOT detect subtitle changes or update appCardSubtitle from sponsored results.
    for (const app of sponsoredApps) {
      const hasAdRating = app.average_rating != null && app.average_rating > 0;
      const hasAdCount = app.rating_count != null && app.rating_count > 0;

      await this.db
        .insert(apps)
        .values({
          slug: app.app_slug,
          name: app.app_name,
          isBuiltForShopify: !!app.is_built_for_shopify,
          ...(app.logo_url && { iconUrl: app.logo_url }),
          ...(hasAdRating && { averageRating: String(app.average_rating) }),
          ...(hasAdCount && { ratingCount: app.rating_count }),
          ...(app.pricing_hint && { pricingHint: app.pricing_hint }),
        })
        .onConflictDoUpdate({
          target: apps.slug,
          set: {
            isBuiltForShopify: !!app.is_built_for_shopify,
            ...(app.logo_url && { iconUrl: sql`COALESCE(${apps.iconUrl}, ${app.logo_url})` }),
            ...(hasAdRating && { averageRating: String(app.average_rating) }),
            ...(hasAdCount && { ratingCount: app.rating_count }),
            ...(app.pricing_hint && { pricingHint: app.pricing_hint }),
          },
        });

      await this.db
        .insert(keywordAdSightings)
        .values({
          appSlug: app.app_slug,
          keywordId,
          seenDate: todayStr,
          firstSeenRunId: runId,
          lastSeenRunId: runId,
          timesSeenInDay: 1,
        })
        .onConflictDoUpdate({
          target: [
            keywordAdSightings.appSlug,
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
}
