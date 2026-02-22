import { eq } from "drizzle-orm";
import type { Database } from "@shopify-tracking/db";
import {
  scrapeRuns,
  trackedKeywords,
  keywordAutoSuggestions,
} from "@shopify-tracking/db";
import { urls, createLogger } from "@shopify-tracking/shared";
import { HttpClient } from "../http-client.js";

const log = createLogger("keyword-suggestion-scraper");

export class KeywordSuggestionScraper {
  private db: Database;
  private httpClient: HttpClient;

  constructor(db: Database, httpClient?: HttpClient) {
    this.db = db;
    this.httpClient = httpClient || new HttpClient();
  }

  /** Scrape autocomplete suggestions for all active keywords */
  async scrapeAll(triggeredBy?: string): Promise<void> {
    const keywords = await this.db
      .select()
      .from(trackedKeywords)
      .where(eq(trackedKeywords.isActive, true));

    if (keywords.length === 0) {
      log.info("no active keywords found");
      return;
    }

    log.info("scraping keyword suggestions", { count: keywords.length });

    const [run] = await this.db
      .insert(scrapeRuns)
      .values({
        scraperType: "keyword_suggestions",
        status: "running",
        createdAt: new Date(),
        startedAt: new Date(),
        triggeredBy,
      })
      .returning();

    const startTime = Date.now();
    let itemsScraped = 0;
    let itemsFailed = 0;

    for (const kw of keywords) {
      try {
        await this.scrapeSuggestions(kw.id, kw.keyword, run.id);
        itemsScraped++;
      } catch (error) {
        log.error("failed to scrape suggestions", {
          keyword: kw.keyword,
          error: String(error),
        });
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

    log.info("suggestions scrape complete", {
      itemsScraped,
      itemsFailed,
      durationMs: Date.now() - startTime,
    });
  }

  /** Scrape autocomplete suggestions for a single keyword */
  async scrapeSuggestions(
    keywordId: number,
    keyword: string,
    runId: string
  ): Promise<string[]> {
    const acUrl = urls.autocomplete(keyword);
    const json = await this.httpClient.fetchPage(acUrl, {
      Accept: "application/json",
    });
    const data = JSON.parse(json);

    const suggestions: string[] = (data.searches || [])
      .map((s: { name: string }) => s.name)
      .filter(
        (name: string) => name.toLowerCase() !== keyword.toLowerCase()
      );

    const now = new Date();
    await this.db
      .insert(keywordAutoSuggestions)
      .values({
        keywordId,
        suggestions,
        scrapedAt: now,
        scrapeRunId: runId,
      })
      .onConflictDoUpdate({
        target: keywordAutoSuggestions.keywordId,
        set: { suggestions, scrapedAt: now, scrapeRunId: runId },
      });

    log.info("saved suggestions", {
      keyword,
      count: suggestions.length,
      suggestions,
    });

    return suggestions;
  }
}
