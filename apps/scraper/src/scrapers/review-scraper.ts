import { eq } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { scrapeRuns, apps, reviews } from "@appranks/db";
import { urls, createLogger } from "@appranks/shared";

const log = createLogger("review-scraper");
import { HttpClient } from "../http-client.js";
import { parseReviewPage } from "../parsers/review-parser.js";

export class ReviewScraper {
  private db: Database;
  private httpClient: HttpClient;
  constructor(
    db: Database,
    httpClient?: HttpClient,
  ) {
    this.db = db;
    this.httpClient = httpClient || new HttpClient();
  }

  /** Scrape reviews for all tracked apps */
  async scrapeTracked(triggeredBy?: string, queue?: string): Promise<void> {
    const trackedApps = await this.db
      .select({ id: apps.id, slug: apps.slug })
      .from(apps)
      .where(eq(apps.isTracked, true));

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
        createdAt: new Date(),
        startedAt: new Date(),
        triggeredBy,
        queue,
      })
      .returning();

    const startTime = Date.now();
    let itemsScraped = 0;
    let itemsFailed = 0;
    let totalNewReviews = 0;

    for (const app of trackedApps) {
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
          new_reviews: totalNewReviews,
          duration_ms: Date.now() - startTime,
        },
      })
      .where(eq(scrapeRuns.id, run.id));

    log.info("scraping complete", { itemsScraped, itemsFailed, totalNewReviews, durationMs: Date.now() - startTime });
  }

  /** Scrape reviews for a single app, returns count of new reviews */
  async scrapeAppReviews(
    slug: string,
    runId: string
  ): Promise<number> {
    log.info("scraping reviews", { slug });

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

    const MAX_PAGES = 50;
    const CUTOFF_DAYS = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CUTOFF_DAYS);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10); // "YYYY-MM-DD"

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
