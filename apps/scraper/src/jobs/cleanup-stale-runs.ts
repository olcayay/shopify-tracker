import { sql, eq, and } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { scrapeRuns } from "@appranks/db";
import { createLogger, type PlatformId } from "@appranks/shared";

const log = createLogger("cleanup-stale-runs");

/** Per-scraper-type timeout in hours for "running" state before marking as stale */
const STALE_TIMEOUT_HOURS: Record<string, number> = {
  category: 4,
  app_details: 3,
  keyword_search: 2,
  keyword_suggestions: 2,
  reviews: 2,
  featured_apps: 2,
  backfill_categories: 3,
  compute_app_scores: 1,
  compute_review_metrics: 1,
  compute_similarity_scores: 1,
  weekly_summary: 2,
};

const DEFAULT_TIMEOUT_HOURS = 2;

/** Scraper types that should be retried when found stale (scheduled batch jobs) */
const RETRYABLE_TYPES = new Set([
  "category",
  "app_details",
  "keyword_search",
  "reviews",
  "featured_apps",
]);

/** Max automatic retries per stale run (per platform+type, rolling 6-hour window) */
const MAX_RETRIES = 3;

export interface CleanupResult {
  running: number;
  pending: number;
  retried: number;
  superseded: number;
}

/**
 * PLA-1081: if two `running` scrape_runs rows share the same (queue, jobId)
 * — which can happen when BullMQ recycles an id while an orphaned row was
 * never flipped to failed — flip all but the newest row to `failed`. This
 * directly resolves the "two running rows with the same bullmq:N id" UI
 * complaint. The older row's worker is by definition either dead or its
 * jobId has been reassigned, so there's no risk of flipping an in-flight
 * job — BullMQ cannot have two live jobs with the same id in the same
 * queue at once.
 */
export async function supersedeDuplicateRunningRuns(db: Database): Promise<number> {
  const result = await db.execute(sql`
    UPDATE scrape_runs SET
      status = 'failed',
      completed_at = now(),
      error = 'orphaned: superseded by newer run with the same bullmq job id (PLA-1081)'
    WHERE id IN (
      SELECT older.id FROM scrape_runs older
      JOIN scrape_runs newer
        ON newer.queue = older.queue
       AND newer.job_id = older.job_id
       AND newer.id <> older.id
       AND newer.started_at > older.started_at
      WHERE older.status = 'running'
        AND newer.status = 'running'
        AND older.job_id IS NOT NULL
        AND older.queue IS NOT NULL
    )
  `);
  const count = (result as any).rowCount ?? 0;
  if (count > 0) {
    log.warn("superseded duplicate running scrape_runs (recycled bullmq ids)", { count });
  }
  return count;
}

/**
 * Mark orphaned scrape_runs as failed:
 *  - "running" entries older than per-type timeout (default 2 hours)
 *  - "pending" entries older than 24 hours
 *
 * For retryable scraper types, automatically re-queue the job (max 1 retry).
 *
 * Called at worker startup and periodically (every 15 min).
 */
export async function cleanupStaleRuns(db: Database): Promise<CleanupResult> {
  // Build per-type CASE expression for dynamic timeout
  const caseExprParts = Object.entries(STALE_TIMEOUT_HOURS)
    .map(([type, hours]) => `WHEN scraper_type = '${type}' THEN interval '${hours} hours'`)
    .join(" ");
  const caseExpr = `CASE ${caseExprParts} ELSE interval '${DEFAULT_TIMEOUT_HOURS} hours' END`;

  // Smoke-test runs: 5 minute timeout (they should finish in < 2 minutes)
  await db
    .update(scrapeRuns)
    .set({
      status: "failed",
      completedAt: new Date(),
      error: "stale smoke-test run: timed out",
    })
    .where(
      sql`${scrapeRuns.status} = 'running' AND ${scrapeRuns.triggeredBy} = 'smoke-test' AND ${scrapeRuns.startedAt} < now() - interval '5 minutes'`
    );

  // Find stale running runs BEFORE updating them (we need their type/platform for retry)
  const staleRunningRuns = await db
    .select({
      id: scrapeRuns.id,
      scraperType: scrapeRuns.scraperType,
      platform: scrapeRuns.platform,
      metadata: scrapeRuns.metadata,
    })
    .from(scrapeRuns)
    .where(
      sql.raw(`status = 'running' AND (triggered_by IS NULL OR triggered_by != 'smoke-test') AND started_at < now() - (${caseExpr})`)
    );

  const runningResult = await db
    .update(scrapeRuns)
    .set({
      status: "failed",
      completedAt: new Date(),
      error: "stale run: marked as failed by cleanup on worker startup",
    })
    .where(
      sql.raw(`status = 'running' AND (triggered_by IS NULL OR triggered_by != 'smoke-test') AND started_at < now() - (${caseExpr})`)
    );

  const pendingResult = await db
    .update(scrapeRuns)
    .set({
      status: "failed",
      completedAt: new Date(),
      error: "stale run: pending too long, marked as failed by cleanup on worker startup",
    })
    .where(
      sql`${scrapeRuns.status} = 'pending' AND ${scrapeRuns.createdAt} < now() - interval '24 hours'`
    );

  const runningCount = (runningResult as any).rowCount ?? 0;
  const pendingCount = (pendingResult as any).rowCount ?? 0;

  // Count recent stale-run-retry attempts per platform+type (rolling 6-hour window)
  // to enforce MAX_RETRIES limit across cleanup cycles
  let recentRetryCountMap = new Map<string, number>();
  try {
    const recentRetries = await db
      .select({
        platform: scrapeRuns.platform,
        scraperType: scrapeRuns.scraperType,
        count: sql<number>`count(*)::int`,
      })
      .from(scrapeRuns)
      .where(sql`${scrapeRuns.triggeredBy} = 'stale-run-retry' AND ${scrapeRuns.createdAt} > now() - interval '6 hours'`)
      .groupBy(scrapeRuns.platform, scrapeRuns.scraperType);

    for (const row of recentRetries) {
      recentRetryCountMap.set(`${row.platform}:${row.scraperType}`, row.count);
    }
  } catch (err) {
    log.warn("failed to query recent retry counts, proceeding with no limit", { error: String(err) });
  }

  // Auto-retry retryable stale runs (max MAX_RETRIES per platform+type in 6 hours)
  let retried = 0;
  for (const run of staleRunningRuns) {
    if (!run.scraperType || !run.platform) continue;
    if (!RETRYABLE_TYPES.has(run.scraperType)) continue;

    // Check retry count for this platform+type (prevents retry storms on persistent failures)
    const retryKey = `${run.platform}:${run.scraperType}`;
    const currentRetries = recentRetryCountMap.get(retryKey) ?? 0;
    if (currentRetries >= MAX_RETRIES) {
      log.warn("max stale retries reached, skipping", {
        staleRunId: run.id,
        scraperType: run.scraperType,
        platform: run.platform,
        currentRetries,
        maxRetries: MAX_RETRIES,
      });
      continue;
    }

    try {
      const { enqueueScraperJob } = await import("../queue.js");
      const jobId = await enqueueScraperJob({
        type: run.scraperType as any,
        platform: run.platform as PlatformId,
        triggeredBy: "stale-run-retry",
        retryOf: run.id,
      });
      retried++;
      recentRetryCountMap.set(retryKey, currentRetries + 1);
      log.info("auto-retried stale run", {
        staleRunId: run.id,
        scraperType: run.scraperType,
        platform: run.platform,
        newJobId: jobId,
        retryCount: currentRetries + 1,
      });
    } catch (err) {
      log.error("failed to retry stale run", {
        staleRunId: run.id,
        scraperType: run.scraperType,
        platform: run.platform,
        error: String(err),
      });
    }
  }

  // PLA-1081: supersede any duplicate `running` rows that share a (queue, jobId)
  // pair. Runs after the time-based cleanup so newly-failed rows are excluded.
  const superseded = await supersedeDuplicateRunningRuns(db);

  if (runningCount > 0 || pendingCount > 0 || retried > 0 || superseded > 0) {
    log.info("cleaned up stale scrape_runs", { running: runningCount, pending: pendingCount, retried, superseded });
  }

  return { running: runningCount, pending: pendingCount, retried, superseded };
}
