import { eq, and } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { scrapeRuns, apps, reviews } from "@appranks/db";
import { urls, createLogger, type PlatformId } from "@appranks/shared";

const log = createLogger("review-scraper");
import { HttpClient } from "../http-client.js";
import { parseReviewPage } from "../parsers/review-parser.js";
import type { PlatformModule } from "../platforms/platform-module.js";
import { runConcurrent } from "../utils/run-concurrent.js";
import { recordItemError } from "../utils/record-item-error.js";

export class ReviewScraper {
  private db: Database;
  private httpClient: HttpClient;
  private platform: PlatformId;
  private platformModule?: PlatformModule;
  public jobId?: string;
  constructor(
    db: Database,
    httpClient?: HttpClient,
    platform: PlatformId = "shopify",
    platformModule?: PlatformModule,
  ) {
    this.db = db;
    this.httpClient = httpClient || new HttpClient();
    this.platform = platform;
    this.platformModule = platformModule;
  }

  /** Scrape reviews for all tracked apps */
  async scrapeTracked(triggeredBy?: string, queue?: string): Promise<void> {
    const trackedApps = await this.db
      .select({ id: apps.id, slug: apps.slug })
      .from(apps)
      .where(and(eq(apps.isTracked, true), eq(apps.platform, this.platform)));

    if (trackedApps.length === 0) {
      log.info("no tracked apps found");
      return;
    }

    log.info("scraping reviews for tracked apps", { count: trackedApps.length });

    const [run] = await this.db
      .insert(scrapeRuns)
      .values({
        scraperType: "reviews",
        status: "running",
        platform: this.platform,
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
    let totalNewReviews = 0;

    try {
      await runConcurrent(trackedApps, async (app) => {
        try {
          const newReviews = await this.scrapeAppReviews(
            app.slug,
            run.id
          );
          totalNewReviews += newReviews;
          itemsScraped++;
        } catch (error) {
          log.error("failed to scrape reviews", { slug: app.slug, error: String(error) });
          itemsFailed++;
          await recordItemError(this.db, {
            scrapeRunId: run.id,
            itemIdentifier: app.slug,
            itemType: "review_app",
            url: this.platformModule ? undefined : urls.appReviews(app.slug),
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
            new_reviews: totalNewReviews,
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
            new_reviews: totalNewReviews,
            duration_ms: Date.now() - startTime,
          },
        })
        .where(eq(scrapeRuns.id, run.id));
      throw error;
    }

    log.info("scraping complete", { itemsScraped, itemsFailed, totalNewReviews, durationMs: Date.now() - startTime });
  }

  /** Scrape reviews for a single app, returns count of new reviews */
  async scrapeAppReviews(
    slug: string,
    runId: string
  ): Promise<number> {
    log.info("scraping reviews", { slug, platform: this.platform });

    // Look up the app's integer ID
    const [appRecord] = await this.db
      .select({ id: apps.id })
      .from(apps)
      .where(eq(apps.slug, slug))
      .limit(1);

    if (!appRecord) {
      log.warn("app not found in database, skipping reviews", { slug });
      return 0;
    }

    const appId = appRecord.id;

    const CUTOFF_DAYS = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CUTOFF_DAYS);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10); // "YYYY-MM-DD"

    // Platform module with fetch+parse → use generic page-by-page flow
    if (this.platformModule?.fetchReviewPage && this.platformModule?.parseReviewPage) {
      return this.scrapePlatformReviews(slug, appId, runId, cutoffStr);
    }

    // Default: Shopify page-by-page flow
    return this.scrapeShopifyReviews(slug, appId, runId, cutoffStr);
  }

  /** Generic page-by-page review scraping via platform module */
  private async scrapePlatformReviews(
    slug: string,
    appId: number,
    runId: string,
    cutoffStr: string
  ): Promise<number> {
    const MAX_PAGES = 50;
    let newReviews = 0;
    let page = 1;
    let hitCutoff = false;

    while (page <= MAX_PAGES) {
      const json = await this.platformModule!.fetchReviewPage!(slug, page);
      if (!json) break;

      const data = this.platformModule!.parseReviewPage!(json, page);
      if (data.reviews.length === 0) break;

      for (const review of data.reviews) {
        try {
          // Stop if we've gone past the 90-day window (reviews sorted newest first)
          if (review.reviewDate < cutoffStr) {
            hitCutoff = true;
            break;
          }

          await this.db
            .insert(reviews)
            .values({
              appId,
              reviewDate: review.reviewDate,
              content: review.content,
              reviewerName: review.reviewerName,
              reviewerCountry: review.reviewerCountry || null,
              durationUsingApp: review.durationUsingApp || null,
              rating: review.rating,
              developerReplyDate: review.developerReplyDate,
              developerReplyText: review.developerReplyText,
              firstSeenRunId: runId,
            })
            .onConflictDoUpdate({
              target: [reviews.appId, reviews.reviewerName],
              set: {
                reviewDate: review.reviewDate,
                content: review.content,
                reviewerCountry: review.reviewerCountry || null,
                durationUsingApp: review.durationUsingApp || null,
                rating: review.rating,
                developerReplyDate: review.developerReplyDate,
                developerReplyText: review.developerReplyText,
              },
            });

          newReviews++;
        } catch (err) {
          log.debug("review insert skipped (likely duplicate)", {
            slug,
            reviewer: review.reviewerName,
            error: String(err),
          });
        }
      }

      if (hitCutoff || !data.hasNextPage) break;
      page++;
    }

    log.info("reviews scraped via platform module", {
      slug,
      platform: this.platform,
      newReviews,
      pages: page,
      hitCutoff,
    });
    return newReviews;
  }

  /** Shopify page-by-page review scraping (original flow) */
  private async scrapeShopifyReviews(
    slug: string,
    appId: number,
    runId: string,
    cutoffStr: string
  ): Promise<number> {
    const MAX_PAGES = 50;
    let newReviews = 0;
    let page = 1;
    let hitCutoff = false;

    while (page <= MAX_PAGES) {
      const reviewUrl = urls.appReviews(slug, page);
      const html = await this.httpClient.fetchPage(reviewUrl);
      const data = parseReviewPage(html, page);

      if (data.reviews.length === 0) break;

      for (const review of data.reviews) {
        try {
          // Parse date string to proper date format
          const parsedDate = parseReviewDate(review.review_date);

          // Stop if we've gone past the 90-day window (reviews sorted newest first)
          if (parsedDate < cutoffStr) {
            hitCutoff = true;
            break;
          }

          await this.db
            .insert(reviews)
            .values({
              appId,
              reviewDate: parsedDate,
              content: review.content,
              reviewerName: review.reviewer_name,
              reviewerCountry: review.reviewer_country || null,
              durationUsingApp: review.duration_using_app || null,
              rating: review.rating,
              developerReplyDate: review.developer_reply_date
                ? parseReviewDate(review.developer_reply_date)
                : null,
              developerReplyText: review.developer_reply_text,
              firstSeenRunId: runId,
            })
            .onConflictDoUpdate({
              target: [reviews.appId, reviews.reviewerName],
              set: {
                reviewDate: parsedDate,
                content: review.content,
                reviewerCountry: review.reviewer_country || null,
                durationUsingApp: review.duration_using_app || null,
                rating: review.rating,
                developerReplyDate: review.developer_reply_date
                  ? parseReviewDate(review.developer_reply_date)
                  : null,
                developerReplyText: review.developer_reply_text,
              },
            });

          newReviews++;
        } catch (err) {
          log.debug("review insert skipped (likely duplicate)", {
            slug,
            reviewer: review.reviewer_name,
            error: String(err),
          });
        }
      }

      if (hitCutoff || !data.has_next_page) break;
      page++;
    }

    log.info("reviews scraped", { slug, newReviews, pages: page, hitCutoff });
    return newReviews;
  }
}

/** Parse "December 29, 2025" to "2025-12-29" */
function parseReviewDate(dateStr: string): string {
  const months: Record<string, string> = {
    January: "01",
    February: "02",
    March: "03",
    April: "04",
    May: "05",
    June: "06",
    July: "07",
    August: "08",
    September: "09",
    October: "10",
    November: "11",
    December: "12",
  };

  const match = dateStr.match(
    /(\w+)\s+(\d{1,2}),\s+(\d{4})/
  );
  if (!match) return dateStr;

  const month = months[match[1]] || "01";
  const day = match[2].padStart(2, "0");
  const year = match[3];

  return `${year}-${month}-${day}`;
}
