/**
 * Post-scrape event detection hooks.
 * Called after each scraper type completes to detect and dispatch events.
 * All functions are wrapped in try/catch — event detection must never break scraping.
 */
import { eq, and, sql, desc } from "drizzle-orm";
import {
  apps,
  appKeywordRankings,
  appCategoryRankings,
  reviews,
  appReviewMetrics,
  featuredAppSightings,
  accountCompetitorApps,
  accountTrackedApps,
  scrapeRuns,
} from "@appranks/db";
import { createLogger } from "@appranks/shared";
import type { PlatformId } from "@appranks/shared";
import {
  checkRankingAlerts,
  checkCategoryAlerts,
  checkNewReviews,
  detectMilestones,
  checkFeaturedChanges,
  checkCompetitorMoves,
  type RankingSnapshot,
  type CategoryRankingSnapshot,
  type ReviewSnapshot,
  type AppMetrics,
  type FeaturedSnapshot,
  type CompetitorSnapshot,
} from "./event-detector.js";
import { dispatchAll } from "./event-dispatcher.js";

const log = createLogger("post-scrape-events");

/**
 * After keyword scraping: detect ranking changes for tracked apps.
 */
export async function afterKeywordScrape(
  db: any,
  platform: PlatformId,
  jobId: string
): Promise<void> {
  try {
    // Resolve BullMQ job ID → scrape run UUID
    const [run] = await db
      .select({ id: scrapeRuns.id })
      .from(scrapeRuns)
      .where(and(eq(scrapeRuns.jobId, jobId), eq(scrapeRuns.scraperType, "keyword_search")))
      .orderBy(desc(scrapeRuns.createdAt))
      .limit(1);

    if (!run) {
      log.warn("no scrape run found for keyword job", { jobId, platform });
      return;
    }
    const scrapeRunId = run.id;

    // Find tracked apps on this platform
    const trackedApps = await db
      .select({
        appId: apps.id,
        appSlug: apps.slug,
        appName: apps.name,
      })
      .from(apps)
      .where(and(eq(apps.platform, platform), eq(apps.isTracked, true)));

    if (trackedApps.length === 0) return;

    for (const app of trackedApps) {
      try {
        // Get current rankings (from this scrape run)
        const currentRankings = await db
          .select({
            keywordId: appKeywordRankings.keywordId,
            position: appKeywordRankings.position,
          })
          .from(appKeywordRankings)
          .where(
            and(
              eq(appKeywordRankings.appId, app.appId),
              eq(appKeywordRankings.scrapeRunId, scrapeRunId)
            )
          );

        // Get previous rankings (most recent before this run)
        const previousRankings = await db
          .select({
            keywordId: appKeywordRankings.keywordId,
            position: appKeywordRankings.position,
          })
          .from(appKeywordRankings)
          .where(
            and(
              eq(appKeywordRankings.appId, app.appId),
              sql`${appKeywordRankings.scrapeRunId} != ${scrapeRunId}`
            )
          )
          .orderBy(desc(appKeywordRankings.scrapedAt))
          .limit(100); // Get enough to cover all keywords

        // TODO: join with keywords table for slug/name — for now use keywordId as slug
        const curSnap: RankingSnapshot[] = currentRankings.map((r: any) => ({
          keywordId: r.keywordId,
          keywordSlug: String(r.keywordId),
          keyword: String(r.keywordId),
          position: r.position,
        }));

        const prevSnap: RankingSnapshot[] = previousRankings.map((r: any) => ({
          keywordId: r.keywordId,
          keywordSlug: String(r.keywordId),
          keyword: String(r.keywordId),
          position: r.position,
        }));

        const events = checkRankingAlerts(app.appId, app.appSlug, app.appName, platform, curSnap, prevSnap);

        // Also check milestones
        const metrics = await getAppMetrics(db, app.appId);
        const prevMetrics = await getPreviousAppMetrics(db, app.appId);
        if (metrics) {
          const milestoneEvents = detectMilestones(
            app.appId, app.appSlug, app.appName, platform,
            metrics, prevMetrics, curSnap
          );
          events.push(...milestoneEvents);
        }

        if (events.length > 0) {
          await dispatchAll(db, events);
        }
      } catch (err) {
        log.error("event detection failed for app", { appId: app.appId, error: String(err) });
      }
    }
  } catch (err) {
    log.error("afterKeywordScrape event detection failed", { platform, error: String(err) });
  }
}

/**
 * After review scraping: detect new reviews and review metrics changes.
 */
export async function afterReviewScrape(
  db: any,
  platform: PlatformId,
  appId: number,
  appSlug: string,
  appName: string,
  newReviewIds: number[]
): Promise<void> {
  try {
    if (newReviewIds.length === 0) return;

    // Get new review details
    const newReviews = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        reviewerName: reviews.reviewerName,
        content: reviews.content,
        reviewDate: reviews.reviewDate,
      })
      .from(reviews)
      .where(sql`${reviews.id} = ANY(ARRAY[${newReviewIds.join(",")}]::int[])`);

    const reviewSnaps: ReviewSnapshot[] = newReviews.map((r: any) => ({
      id: r.id,
      rating: r.rating,
      reviewerName: r.reviewerName,
      content: r.content,
      reviewDate: r.reviewDate?.toISOString?.() ?? null,
    }));

    const metrics = await getAppMetrics(db, appId);
    const prevMetrics = await getPreviousAppMetrics(db, appId);

    const events = checkNewReviews(
      appId, appSlug, appName, platform,
      reviewSnaps, new Set(), // all are new
      metrics, prevMetrics
    );

    if (events.length > 0) {
      await dispatchAll(db, events);
    }
  } catch (err) {
    log.error("afterReviewScrape event detection failed", { appId, error: String(err) });
  }
}

/**
 * After category scraping: detect category ranking changes.
 */
export async function afterCategoryScrape(
  db: any,
  platform: PlatformId,
  jobId: string
): Promise<void> {
  try {
    // Resolve BullMQ job ID → scrape run UUID
    const [run] = await db
      .select({ id: scrapeRuns.id })
      .from(scrapeRuns)
      .where(and(eq(scrapeRuns.jobId, jobId), eq(scrapeRuns.scraperType, "category")))
      .orderBy(desc(scrapeRuns.createdAt))
      .limit(1);

    if (!run) {
      log.warn("no scrape run found for category job", { jobId, platform });
      return;
    }
    const scrapeRunId = run.id;

    const trackedApps = await db
      .select({ appId: apps.id, appSlug: apps.slug, appName: apps.name })
      .from(apps)
      .where(and(eq(apps.platform, platform), eq(apps.isTracked, true)));

    for (const app of trackedApps) {
      try {
        const currentCatRankings = await db
          .select({
            categorySlug: appCategoryRankings.categorySlug,
            position: appCategoryRankings.position,
          })
          .from(appCategoryRankings)
          .where(
            and(
              eq(appCategoryRankings.appId, app.appId),
              eq(appCategoryRankings.scrapeRunId, scrapeRunId)
            )
          );

        const previousCatRankings = await db
          .select({
            categorySlug: appCategoryRankings.categorySlug,
            position: appCategoryRankings.position,
          })
          .from(appCategoryRankings)
          .where(
            and(
              eq(appCategoryRankings.appId, app.appId),
              sql`${appCategoryRankings.scrapeRunId} != ${scrapeRunId}`
            )
          )
          .orderBy(desc(appCategoryRankings.scrapedAt))
          .limit(100);

        const curSnap: CategoryRankingSnapshot[] = currentCatRankings.map((r: any) => ({
          categorySlug: r.categorySlug,
          categoryName: r.categorySlug, // TODO: resolve name
          position: r.position,
        }));

        const prevSnap: CategoryRankingSnapshot[] = previousCatRankings.map((r: any) => ({
          categorySlug: r.categorySlug,
          categoryName: r.categorySlug,
          position: r.position,
        }));

        const events = checkCategoryAlerts(app.appId, app.appSlug, app.appName, platform, curSnap, prevSnap);

        if (events.length > 0) {
          await dispatchAll(db, events);
        }
      } catch (err) {
        log.error("category event detection failed for app", { appId: app.appId, error: String(err) });
      }
    }
  } catch (err) {
    log.error("afterCategoryScrape event detection failed", { platform, error: String(err) });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

async function getAppMetrics(db: any, appId: number): Promise<AppMetrics | null> {
  const [row] = await db
    .select({
      averageRating: appReviewMetrics.averageRating,
      ratingCount: appReviewMetrics.ratingCount,
      reviewVelocity7d: appReviewMetrics.v7d,
    })
    .from(appReviewMetrics)
    .where(eq(appReviewMetrics.appId, appId))
    .orderBy(desc(appReviewMetrics.computedAt))
    .limit(1);

  return row ? {
    averageRating: row.averageRating ? Number(row.averageRating) : null,
    ratingCount: row.ratingCount,
    reviewVelocity7d: row.reviewVelocity7d,
  } : null;
}

async function getPreviousAppMetrics(db: any, appId: number): Promise<AppMetrics | null> {
  const rows = await db
    .select({
      averageRating: appReviewMetrics.averageRating,
      ratingCount: appReviewMetrics.ratingCount,
      reviewVelocity7d: appReviewMetrics.v7d,
    })
    .from(appReviewMetrics)
    .where(eq(appReviewMetrics.appId, appId))
    .orderBy(desc(appReviewMetrics.computedAt))
    .limit(2);

  // Return second most recent (skip the latest)
  const row = rows[1];
  return row ? {
    averageRating: row.averageRating ? Number(row.averageRating) : null,
    ratingCount: row.ratingCount,
    reviewVelocity7d: row.reviewVelocity7d,
  } : null;
}
