import { eq } from "drizzle-orm";
import type { Database } from "@shopify-tracking/db";
import {
  scrapeRuns,
  trackedKeywords,
  keywordSnapshots,
  apps,
  appKeywordRankings,
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
  async scrapeAll(): Promise<void> {
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

  /** Scrape search results for a single keyword */
  async scrapeKeyword(
    keywordId: number,
    keyword: string,
    runId: string
  ): Promise<void> {
    log.info("scraping keyword", { keyword });

    const searchUrl = urls.search(keyword);
    const html = await this.httpClient.fetchPage(searchUrl, {
      "Turbo-Frame": "search_page",
    });
    const data = parseSearchPage(html, keyword, 1);

    // Insert keyword snapshot
    await this.db.insert(keywordSnapshots).values({
      keywordId,
      scrapeRunId: runId,
      scrapedAt: new Date(),
      totalResults: data.total_results,
      results: data.apps,
    });

    // Record individual app rankings
    const now = new Date();
    for (const app of data.apps) {
      // Upsert app record
      await this.db
        .insert(apps)
        .values({ slug: app.app_slug, name: app.app_name })
        .onConflictDoNothing();

      await this.db.insert(appKeywordRankings).values({
        appSlug: app.app_slug,
        keywordId,
        scrapeRunId: runId,
        scrapedAt: now,
        position: app.position,
      });
    }
  }
}
