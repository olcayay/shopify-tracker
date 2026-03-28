import { sql } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { createLogger } from "@appranks/shared";

const log = createLogger("data-cleanup");

/** Default retention periods (configurable via env vars) */
const SNAPSHOT_RETENTION_MONTHS = parseInt(process.env.DATA_RETENTION_SNAPSHOT_MONTHS || "12", 10);
const SCRAPE_RUNS_RETENTION_MONTHS = parseInt(process.env.DATA_RETENTION_SCRAPE_RUNS_MONTHS || "6", 10);
const DLQ_RETENTION_MONTHS = parseInt(process.env.DATA_RETENTION_DLQ_MONTHS || "3", 10);

interface CleanupResult {
  table: string;
  deletedRows: number;
}

/**
 * Delete old data from snapshot and log tables to control database growth.
 *
 * Retention periods (configurable via env):
 *   - app_snapshots: 12 months (DATA_RETENTION_SNAPSHOT_MONTHS)
 *   - keyword_snapshots: 12 months (DATA_RETENTION_SNAPSHOT_MONTHS)
 *   - scrape_runs: 6 months (DATA_RETENTION_SCRAPE_RUNS_MONTHS)
 *   - dead_letter_jobs: 3 months (DATA_RETENTION_DLQ_MONTHS)
 *
 * Runs VACUUM ANALYZE on each table after deletion.
 */
export async function dataCleanup(db: Database, jobId?: string): Promise<CleanupResult[]> {
  log.info("starting data cleanup", {
    jobId,
    snapshotRetentionMonths: SNAPSHOT_RETENTION_MONTHS,
    scrapeRunsRetentionMonths: SCRAPE_RUNS_RETENTION_MONTHS,
    dlqRetentionMonths: DLQ_RETENTION_MONTHS,
  });

  const results: CleanupResult[] = [];

  const tables = [
    {
      table: "app_snapshots",
      column: "scraped_at",
      months: SNAPSHOT_RETENTION_MONTHS,
    },
    {
      table: "keyword_snapshots",
      column: "scraped_at",
      months: SNAPSHOT_RETENTION_MONTHS,
    },
    {
      table: "scrape_runs",
      column: "completed_at",
      months: SCRAPE_RUNS_RETENTION_MONTHS,
    },
    {
      table: "dead_letter_jobs",
      column: "failed_at",
      months: DLQ_RETENTION_MONTHS,
    },
  ];

  for (const { table, column, months } of tables) {
    try {
      const result = await db.execute(
        sql.raw(`DELETE FROM "${table}" WHERE "${column}" < now() - interval '${months} months'`),
      );
      const deletedRows = (result as any).rowCount ?? 0;
      results.push({ table, deletedRows });

      if (deletedRows > 0) {
        log.info("deleted old rows", { table, deletedRows, retentionMonths: months });

        // VACUUM ANALYZE to reclaim space and update statistics
        try {
          await db.execute(sql.raw(`VACUUM ANALYZE "${table}"`));
          log.info("vacuum analyze complete", { table });
        } catch (vacErr: any) {
          // VACUUM can fail inside transactions — log and continue
          log.warn("vacuum analyze failed (expected inside transaction)", {
            table,
            error: vacErr.message,
          });
        }
      }
    } catch (err: any) {
      log.error("cleanup failed for table", { table, error: err.message });
      // Continue with other tables
    }
  }

  const totalDeleted = results.reduce((sum, r) => sum + r.deletedRows, 0);
  log.info("data cleanup complete", { jobId, totalDeleted, results });

  return results;
}
