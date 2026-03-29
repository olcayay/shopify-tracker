import { sql } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { scrapeRuns } from "@appranks/db";
import { createLogger } from "@appranks/shared";

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
};

const DEFAULT_TIMEOUT_HOURS = 2;

/**
 * Mark orphaned scrape_runs as failed:
 *  - "running" entries older than per-type timeout (default 2 hours)
 *  - "pending" entries older than 24 hours
 *
 * Called at worker startup to clean up leftovers from crashes/restarts.
 */
export async function cleanupStaleRuns(db: Database): Promise<{ running: number; pending: number }> {
  // Build per-type CASE expression for dynamic timeout
  const caseExprParts = Object.entries(STALE_TIMEOUT_HOURS)
    .map(([type, hours]) => `WHEN scraper_type = '${type}' THEN interval '${hours} hours'`)
    .join(" ");
  const caseExpr = `CASE ${caseExprParts} ELSE interval '${DEFAULT_TIMEOUT_HOURS} hours' END`;

  const runningResult = await db
    .update(scrapeRuns)
    .set({
      status: "failed",
      completedAt: new Date(),
      error: "stale run: marked as failed by cleanup on worker startup",
    })
    .where(
      sql.raw(`status = 'running' AND started_at < now() - (${caseExpr})`)
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

  if (runningCount > 0 || pendingCount > 0) {
    log.info("cleaned up stale scrape_runs", { running: runningCount, pending: pendingCount });
  }

  return { running: runningCount, pending: pendingCount };
}
