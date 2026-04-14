import { sql, eq, and } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { scrapeRuns } from "@appranks/db";
import { createLogger, type PlatformId } from "@appranks/shared";

const log = createLogger("cleanup-stale-runs");

/**
 * Per-scraper-type progress-stall threshold in minutes. A running row is
 * considered stale only when `last_progress_at` has not advanced for this
 * long — a healthy long run keeps bumping the heartbeat every few seconds
 * via the `tr_scrape_runs_touch_last_progress` trigger, so we no longer
 * kill genuinely-advancing multi-hour runs (PLA-1081 follow-up).
 *
 * Values are per single-item budgets × a generous safety factor: the slowest
 * observed single-app scrape is ~1 minute, so 20 minutes catches real stalls
 * while being resilient to transient rate-limit backoffs and long individual
 * category page loads.
 */
const STALL_MINUTES: Record<string, number> = {
  category: 30,
  app_details: 20,
  keyword_search: 20,
  keyword_suggestions: 20,
  reviews: 20,
  featured_apps: 20,
  backfill_categories: 30,
  compute_app_scores: 15,
  compute_review_metrics: 15,
  compute_similarity_scores: 15,
  weekly_summary: 20,
};

const DEFAULT_STALL_MINUTES = 20;

/** Absolute ceiling: even without progress signal, flip after this long. */
const ABSOLUTE_MAX_HOURS = 24;

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
  // Progress-aware staleness (PLA-1081 follow-up): a run is stale only when
  // its last_progress_at heartbeat (auto-bumped by a DB trigger when metadata
  // changes) has not advanced for per-type STALL_MINUTES — or an absolute
  // ceiling ABSOLUTE_MAX_HOURS catches runs that somehow stopped heartbeating
  // entirely. Starts-only threshold is gone: a healthy long-running scrape
  // keeps touching the row every few seconds, so multi-hour advancing runs
  // are no longer killed by a fixed time budget.
  const stallCaseParts = Object.entries(STALL_MINUTES)
    .map(([type, mins]) => `WHEN scraper_type = '${type}' THEN interval '${mins} minutes'`)
    .join(" ");
  const stallCase = `CASE ${stallCaseParts} ELSE interval '${DEFAULT_STALL_MINUTES} minutes' END`;
  const staleFilter = `status = 'running'
      AND (triggered_by IS NULL OR triggered_by != 'smoke-test')
      AND (
        (last_progress_at IS NOT NULL AND last_progress_at < now() - (${stallCase}))
        OR started_at < now() - interval '${ABSOLUTE_MAX_HOURS} hours'
      )`;

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
    .where(sql.raw(staleFilter));

  const runningResult = await db
    .update(scrapeRuns)
    .set({
      status: "failed",
      completedAt: new Date(),
      error: "stale run: no progress in STALL_MINUTES (progress-aware cleanup)",
    })
    .where(sql.raw(staleFilter));

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
