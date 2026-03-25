import { sql } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { scrapeRuns } from "@appranks/db";
import { createLogger } from "@appranks/shared";

const log = createLogger("cleanup-stale-runs");

/**
 * Mark orphaned scrape_runs as failed:
 *  - "running" entries older than 2 hours
 *  - "pending" entries older than 24 hours
 *
 * Called at worker startup to clean up leftovers from crashes/restarts.
 */
export async function cleanupStaleRuns(db: Database): Promise<{ running: number; pending: number }> {
  const runningResult = await db
    .update(scrapeRuns)
    .set({
      status: "failed",
      completedAt: new Date(),
      error: "stale run: marked as failed by cleanup on worker startup",
    })
    .where(
      sql`${scrapeRuns.status} = 'running' AND ${scrapeRuns.startedAt} < now() - interval '2 hours'`
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
