import { eq, sql } from "drizzle-orm";
import type { Database } from "@shopify-tracking/db";
import { scrapeRuns, apps, appReviewMetrics } from "@shopify-tracking/db";
import { createLogger } from "@shopify-tracking/shared";

const log = createLogger("compute-review-metrics");

interface ReviewCountRow {
  app_slug: string;
  rating_count: number | null;
  average_rating: string | null;
  v7d: number;
  v30d: number;
  v90d: number;
}

interface ReviewVelocityMetrics {
  v7d: number;
  v30d: number;
  v90d: number;
  accMicro: number | null;
  accMacro: number | null;
  momentum: string;
}

function computeMetrics(v7d: number, v30d: number, v90d: number): ReviewVelocityMetrics {
  const expected7dFrom30d = v30d / (30 / 7); // ~v30d / 4.285
  const accMicro = Math.round((v7d - expected7dFrom30d) * 100) / 100;

  const expected30dFrom90d = v90d / 3;
  const accMacro = Math.round((v30d - expected30dFrom90d) * 100) / 100;

  let momentum: string;
  if (v30d === 0 && v7d === 0) {
    momentum = "flat";
  } else if (expected7dFrom30d > 0 && accMicro > expected7dFrom30d) {
    // 7d pace is more than 2x the 30d-normalized pace
    momentum = "spike";
  } else if (accMicro > 0 && accMacro > 0) {
    momentum = "accelerating";
  } else if (accMicro < 0 || accMacro < 0) {
    momentum = "slowing";
  } else {
    momentum = "stable";
  }

  return { v7d, v30d, v90d, accMicro, accMacro, momentum };
}

export async function computeReviewMetrics(db: Database, triggeredBy: string): Promise<void> {
  const startTime = Date.now();

  // Create scrape run record
  const [run] = await db
    .insert(scrapeRuns)
    .values({
      scraperType: "compute_review_metrics",
      status: "running",
      createdAt: new Date(),
      startedAt: new Date(),
      triggeredBy,
    })
    .returning();

  try {
    // Get all tracked app slugs
    const trackedApps = await db
      .select({ slug: apps.slug })
      .from(apps)
      .where(eq(apps.isTracked, true));

    if (trackedApps.length === 0) {
      log.info("no tracked apps found");
      await db
        .update(scrapeRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          metadata: { apps_computed: 0, duration_ms: Date.now() - startTime },
        })
        .where(eq(scrapeRuns.id, run.id));
      return;
    }

    const slugs = trackedApps.map((a) => a.slug);
    const slugList = sql.join(slugs.map((s) => sql`${s}`), sql`, `);

    // Count reviews in 7d/30d/90d windows directly from reviews table
    // Also get current ratingCount + averageRating from latest snapshot
    const rows: ReviewCountRow[] = await db.execute(sql`
      SELECT
        a.slug AS app_slug,
        snap.rating_count,
        snap.average_rating,
        COALESCE(rv.v7d, 0)::int AS v7d,
        COALESCE(rv.v30d, 0)::int AS v30d,
        COALESCE(rv.v90d, 0)::int AS v90d
      FROM apps a
      LEFT JOIN LATERAL (
        SELECT rating_count, average_rating
        FROM app_snapshots
        WHERE app_slug = a.slug
        ORDER BY scraped_at DESC
        LIMIT 1
      ) snap ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE review_date >= CURRENT_DATE - 7) AS v7d,
          COUNT(*) FILTER (WHERE review_date >= CURRENT_DATE - 30) AS v30d,
          COUNT(*) FILTER (WHERE review_date >= CURRENT_DATE - 90) AS v90d
        FROM reviews
        WHERE app_slug = a.slug
          AND review_date >= CURRENT_DATE - 90
      ) rv ON true
      WHERE a.slug IN (${slugList})
    `).then((res: any) => (res as any).rows ?? res);

    const today = new Date().toISOString().slice(0, 10);
    let computed = 0;

    for (const row of rows) {
      const metrics = computeMetrics(row.v7d, row.v30d, row.v90d);

      await db
        .insert(appReviewMetrics)
        .values({
          appSlug: row.app_slug,
          computedAt: today,
          ratingCount: row.rating_count,
          averageRating: row.average_rating,
          v7d: metrics.v7d,
          v30d: metrics.v30d,
          v90d: metrics.v90d,
          accMicro: metrics.accMicro != null ? String(metrics.accMicro) : null,
          accMacro: metrics.accMacro != null ? String(metrics.accMacro) : null,
          momentum: metrics.momentum,
        })
        .onConflictDoUpdate({
          target: [appReviewMetrics.appSlug, appReviewMetrics.computedAt],
          set: {
            ratingCount: row.rating_count,
            averageRating: row.average_rating,
            v7d: metrics.v7d,
            v30d: metrics.v30d,
            v90d: metrics.v90d,
            accMicro: metrics.accMicro != null ? String(metrics.accMicro) : null,
            accMacro: metrics.accMacro != null ? String(metrics.accMacro) : null,
            momentum: metrics.momentum,
          },
        });

      computed++;
    }

    const durationMs = Date.now() - startTime;
    log.info("review metrics computed", { computed, durationMs });

    await db
      .update(scrapeRuns)
      .set({
        status: "completed",
        completedAt: new Date(),
        metadata: { apps_computed: computed, duration_ms: durationMs },
      })
      .where(eq(scrapeRuns.id, run.id));
  } catch (error) {
    log.error("failed to compute review metrics", { error: String(error) });
    await db
      .update(scrapeRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: String(error),
      })
      .where(eq(scrapeRuns.id, run.id));
    throw error;
  }
}
