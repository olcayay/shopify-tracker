import { eq, sql } from "drizzle-orm";
import type { Database } from "@shopify-tracking/db";
import {
  scrapeRuns,
  trackedKeywords,
  keywordSnapshots,
  apps,
  appKeywordRankings,
  keywordAdSightings,
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
  async scrapeAll(triggeredBy?: string): Promise<void> {
    const keywords = await this.db
      .select()
      .from(trackedKeywords)
      .where(eq(trackedKeywords.isActive, true));

    if (keywords.length === 0) {
      log.info("no active keywords found");
      return;
    }

    log.info("scraping tracked keywords", { count: keywords.length });

    const [run] = await this.db
      .insert(scrapeRuns)
      .values({
        scraperType: "keyword_search",
        status: "running",
        startedAt: new Date(),
        triggeredBy,
      })
      .returning();

    const startTime = Date.now();
    let itemsScraped = 0;
    let itemsFailed = 0;

    for (const kw of keywords) {
      try {
        await this.scrapeKeyword(kw.id, kw.keyword, run.id);
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

    log.info("scraping complete", { itemsScraped, itemsFailed, durationMs: Date.now() - startTime });
  }

  /** Scrape search results for a single keyword (fetches up to 4 pages) */
  async scrapeKeyword(
    keywordId: number,
    keyword: string,
    runId: string
  ): Promise<void> {
    log.info("scraping keyword", { keyword });

    const MAX_PAGES = 4;
    const allApps: import("@shopify-tracking/shared").KeywordSearchApp[] = [];
    const seenSlugs = new Set<string>();
    let totalResults: number | null = null;
    let organicCount = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const searchUrl = urls.search(keyword, page);
      const html = await this.httpClient.fetchPage(searchUrl, {
        "Turbo-Frame": "search_page",
      });
      const data = parseSearchPage(html, keyword, page, organicCount);

      if (page === 1) totalResults = data.total_results;

      // Deduplicate across pages
      for (const app of data.apps) {
        if (!seenSlugs.has(app.app_slug)) {
          seenSlugs.add(app.app_slug);
          allApps.push(app);
          if (!app.is_sponsored && !app.is_built_in) organicCount++;
        }
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
      await this.db
        .insert(apps)
        .values({ slug: app.app_slug, name: app.app_name })
        .onConflictDoNothing();

      await this.db.insert(appKeywordRankings).values({
        appSlug: app.app_slug,
        keywordId,
        scrapeRunId: runId,
        scrapedAt: now,
        position: i + 1,
      });
    }

    // Record ad sightings (upsert per app+keyword+day)
    for (const app of sponsoredApps) {
      await this.db
        .insert(apps)
        .values({ slug: app.app_slug, name: app.app_name })
        .onConflictDoNothing();

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
  }
}
