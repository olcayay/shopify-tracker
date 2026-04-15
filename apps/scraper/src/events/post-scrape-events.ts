/**
 * Post-scrape event detection hooks.
 * Called after each scraper type completes to detect and dispatch events.
 * All functions are wrapped in try/catch — event detection must never break scraping.
 */
import { eq, and, sql, desc, inArray } from "drizzle-orm";
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

    const appIds = trackedApps.map((a: any) => a.appId);
    const t1 = Date.now();

    // Batch query: get ALL current rankings for all tracked apps in ONE query
    const allCurrentRankings: any[] = await db
      .select({
        appId: appKeywordRankings.appId,
        keywordId: appKeywordRankings.keywordId,
        position: appKeywordRankings.position,
      })
      .from(appKeywordRankings)
      .where(
        and(
          inArray(appKeywordRankings.appId, appIds),
          eq(appKeywordRankings.scrapeRunId, scrapeRunId)
        )
      );

    // Batch query: get ALL previous rankings in ONE query
    const allPreviousRankings: any[] = await db
      .select({
        appId: appKeywordRankings.appId,
        keywordId: appKeywordRankings.keywordId,
        position: appKeywordRankings.position,
      })
      .from(appKeywordRankings)
      .where(
        and(
          inArray(appKeywordRankings.appId, appIds),
          sql`${appKeywordRankings.scrapeRunId} != ${scrapeRunId}`
        )
      )
      .orderBy(desc(appKeywordRankings.scrapedAt))
      .limit(appIds.length * 100);

    // Batch query: get ALL metrics in ONE query
    const allMetrics: any[] = await db
      .select({
        appId: appReviewMetrics.appId,
        averageRating: appReviewMetrics.averageRating,
        ratingCount: appReviewMetrics.ratingCount,
        reviewVelocity7d: appReviewMetrics.v7d,
        computedAt: appReviewMetrics.computedAt,
      })
      .from(appReviewMetrics)
      .where(inArray(appReviewMetrics.appId, appIds))
      .orderBy(desc(appReviewMetrics.computedAt));

    log.info("batch queries completed", { apps: appIds.length, queryMs: Date.now() - t1 });

    // Group by appId in memory
    const curByApp = new Map<number, any[]>();
    for (const r of allCurrentRankings) {
      const list = curByApp.get(r.appId) || [];
      list.push(r);
      curByApp.set(r.appId, list);
    }

    const prevByApp = new Map<number, any[]>();
    for (const r of allPreviousRankings) {
      const list = prevByApp.get(r.appId) || [];
      // Deduplicate: keep only the first (newest, due to DESC order) entry per keywordId
      if (!list.some((existing) => existing.keywordId === r.keywordId)) {
        list.push(r);
      }
      prevByApp.set(r.appId, list);
    }

    // Group metrics: first 2 per app (latest + previous)
    const metricsByApp = new Map<number, { latest: any; previous: any | null }>();
    for (const m of allMetrics) {
      if (!metricsByApp.has(m.appId)) {
        metricsByApp.set(m.appId, { latest: m, previous: null });
      } else {
        const entry = metricsByApp.get(m.appId)!;
        if (!entry.previous) entry.previous = m;
      }
    }

    for (const app of trackedApps) {
      try {
        const currentRankings = curByApp.get(app.appId) || [];
        const previousRankings = prevByApp.get(app.appId) || [];

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

        const metricsEntry = metricsByApp.get(app.appId);
        const metrics = metricsEntry?.latest ? {
          averageRating: metricsEntry.latest.averageRating ? Number(metricsEntry.latest.averageRating) : null,
          ratingCount: metricsEntry.latest.ratingCount,
          reviewVelocity7d: metricsEntry.latest.reviewVelocity7d,
        } : null;
        const prevMetrics = metricsEntry?.previous ? {
          averageRating: metricsEntry.previous.averageRating ? Number(metricsEntry.previous.averageRating) : null,
          ratingCount: metricsEntry.previous.ratingCount,
          reviewVelocity7d: metricsEntry.previous.reviewVelocity7d,
        } : null;

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
      .where(inArray(reviews.id, newReviewIds));

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

    if (trackedApps.length === 0) return;

    const appIds = trackedApps.map((a: any) => a.appId);
    const t1 = Date.now();

    // Batch query: all current category rankings
    const allCurCat: any[] = await db
      .select({
        appId: appCategoryRankings.appId,
        categorySlug: appCategoryRankings.categorySlug,
        position: appCategoryRankings.position,
      })
      .from(appCategoryRankings)
      .where(
        and(
          inArray(appCategoryRankings.appId, appIds),
          eq(appCategoryRankings.scrapeRunId, scrapeRunId)
        )
      );

    // Batch query: all previous category rankings
    const allPrevCat: any[] = await db
      .select({
        appId: appCategoryRankings.appId,
        categorySlug: appCategoryRankings.categorySlug,
        position: appCategoryRankings.position,
      })
      .from(appCategoryRankings)
      .where(
        and(
          inArray(appCategoryRankings.appId, appIds),
          sql`${appCategoryRankings.scrapeRunId} != ${scrapeRunId}`
        )
      )
      .orderBy(desc(appCategoryRankings.scrapedAt))
      .limit(appIds.length * 100);

    log.info("batch category queries completed", { apps: appIds.length, queryMs: Date.now() - t1 });

    // Group by appId
    const curCatByApp = new Map<number, any[]>();
    for (const r of allCurCat) {
      const list = curCatByApp.get(r.appId) || [];
      list.push(r);
      curCatByApp.set(r.appId, list);
    }
    const prevCatByApp = new Map<number, any[]>();
    for (const r of allPrevCat) {
      const list = prevCatByApp.get(r.appId) || [];
      // Deduplicate: keep only the first (newest, due to DESC order) entry per categorySlug
      if (!list.some((existing) => existing.categorySlug === r.categorySlug)) {
        list.push(r);
      }
      prevCatByApp.set(r.appId, list);
    }

    for (const app of trackedApps) {
      try {
        const curSnap: CategoryRankingSnapshot[] = (curCatByApp.get(app.appId) || []).map((r: any) => ({
          categorySlug: r.categorySlug,
          categoryName: r.categorySlug,
          position: r.position,
        }));

        const prevSnap: CategoryRankingSnapshot[] = (prevCatByApp.get(app.appId) || []).map((r: any) => ({
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

/**
 * Refresh the developer_platform_stats materialized view so /api/developers
 * sort-by-apps / avgRating / firstLaunch / lastLaunch stays fresh.
 *
 * CONCURRENTLY avoids read-side locking; it requires the unique index on
 * (global_developer_id, platform) created in migration 0155. Falls back to a
 * blocking refresh only if the MV is missing (e.g. first deploy before
 * migration runs).
 *
 * Called from post-scrape hooks (category + keyword batches). Safe to call
 * more often — Postgres serialises concurrent REFRESHes.
 *
 * PLA-1103.
 */
export async function refreshDeveloperPlatformStats(db: any): Promise<void> {
  try {
    const t1 = Date.now();
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY developer_platform_stats`);
    log.info("refreshed developer_platform_stats", { durationMs: Date.now() - t1 });
  } catch (err) {
    log.error("refreshDeveloperPlatformStats failed", { error: String(err) });
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
