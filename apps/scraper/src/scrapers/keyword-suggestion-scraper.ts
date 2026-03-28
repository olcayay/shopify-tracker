import { eq, and } from "drizzle-orm";
import type { Database } from "@appranks/db";
import {
  scrapeRuns,
  trackedKeywords,
  keywordAutoSuggestions,
} from "@appranks/db";
import { urls, createLogger, PLATFORMS, type PlatformId } from "@appranks/shared";
import { HttpClient } from "../http-client.js";
import type { PlatformModule } from "../platforms/platform-module.js";
import { runConcurrent } from "../utils/run-concurrent.js";

const log = createLogger("keyword-suggestion-scraper");

export class KeywordSuggestionScraper {
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

  /** Scrape autocomplete suggestions for all active keywords on this platform */
  async scrapeAll(triggeredBy?: string, queue?: string): Promise<void> {
    const keywords = await this.db
      .select()
      .from(trackedKeywords)
      .where(and(
        eq(trackedKeywords.isActive, true),
        eq(trackedKeywords.platform, this.platform)
      ));

    if (keywords.length === 0) {
      log.info("no active keywords found", { platform: this.platform });
      return;
    }

    log.info("scraping keyword suggestions", { count: keywords.length, platform: this.platform });

    const [run] = await this.db
      .insert(scrapeRuns)
      .values({
        scraperType: "keyword_suggestions",
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
      await runConcurrent(keywords, async (kw) => {
        try {
          await this.scrapeSuggestions(kw.id, kw.keyword, run.id);
          itemsScraped++;
        } catch (error) {
          log.error("failed to scrape suggestions", {
            keyword: kw.keyword,
            platform: this.platform,
            error: String(error),
          });
          itemsFailed++;
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

    log.info("suggestions scrape complete", {
      platform: this.platform,
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
    let suggestions: string[];

    // Check if platform supports auto-suggestions
    const platformConfig = PLATFORMS[this.platform];
    if (!platformConfig?.hasAutoSuggestions) {
      log.info("platform does not support auto-suggestions, skipping", { platform: this.platform, keyword });
      return [];
    }

    // Use platform module's generateSuggestions if available (Canva, Wix)
    if (this.platformModule && "generateSuggestions" in this.platformModule) {
      suggestions = await (this.platformModule as any).generateSuggestions(keyword);
    } else if (this.platform === "shopify") {
      // Shopify: use autocomplete API
      const acUrl = urls.autocomplete(keyword);
      const json = await this.httpClient.fetchPage(acUrl, {
        Accept: "application/json",
      });
      const data = JSON.parse(json);

      suggestions = (data.searches || [])
        .map((s: { name: string }) => s.name)
        .filter(
          (name: string) => name.toLowerCase() !== keyword.toLowerCase()
        );
    } else {
      log.warn("platform has hasAutoSuggestions=true but no suggestion implementation", { platform: this.platform, keyword });
      return [];
    }

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
      platform: this.platform,
      count: suggestions.length,
      suggestions,
    });

    return suggestions;
  }
}
