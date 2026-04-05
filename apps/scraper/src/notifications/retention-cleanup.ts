/**
 * Notification retention cleanup (PLA-688).
 * Deletes old notifications and delivery logs in batches.
 * Designed to run as a daily cron job.
 */
import { sql } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { createLogger } from "@appranks/shared";

const log = createLogger("notification:retention");

/** Default retention period in days */
const DEFAULT_RETENTION_DAYS = parseInt(
  process.env.NOTIFICATION_RETENTION_DAYS || "90",
  10
);

/** Batch size for deletion to avoid long-running transactions */
const BATCH_SIZE = 1000;

export interface CleanupResult {
  notificationsDeleted: number;
  deliveryLogsDeleted: number;
  retentionDays: number;
  cutoffDate: string;
  durationMs: number;
}

/**
 * Delete old notifications and delivery logs beyond the retention period.
 * Deletes in batches to avoid locking the table.
 */
export async function cleanupOldNotifications(
  db: Database,
  retentionDays = DEFAULT_RETENTION_DAYS
): Promise<CleanupResult> {
  const startTime = Date.now();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffStr = cutoff.toISOString();

  log.info("starting notification retention cleanup", {
    retentionDays,
    cutoff: cutoffStr,
  });

  // 1. Count what we're about to delete (for logging)
  let notificationsDeleted = 0;
  let deliveryLogsDeleted = 0;

  // 2. Delete delivery logs first (they reference notifications)
  let deletedBatch: number;
  do {
    const result: any = await db.execute(sql`
      DELETE FROM notification_delivery_log
      WHERE notification_id IN (
        SELECT id FROM notifications
        WHERE created_at < ${cutoffStr}
        LIMIT ${BATCH_SIZE}
      )
    `);
    deletedBatch = (result as any)?.rowCount ?? (result as any)?.rows?.length ?? 0;
    deliveryLogsDeleted += deletedBatch;
  } while (deletedBatch >= BATCH_SIZE);

  // 3. Delete old notifications in batches
  do {
    const result: any = await db.execute(sql`
      DELETE FROM notifications
      WHERE id IN (
        SELECT id FROM notifications
        WHERE created_at < ${cutoffStr}
        LIMIT ${BATCH_SIZE}
      )
    `);
    deletedBatch = (result as any)?.rowCount ?? (result as any)?.rows?.length ?? 0;
    notificationsDeleted += deletedBatch;
  } while (deletedBatch >= BATCH_SIZE);

  const durationMs = Date.now() - startTime;

  log.info("notification retention cleanup complete", {
    notificationsDeleted,
    deliveryLogsDeleted,
    retentionDays,
    durationMs,
  });

  return {
    notificationsDeleted,
    deliveryLogsDeleted,
    retentionDays,
    cutoffDate: cutoffStr,
    durationMs,
  };
}

/**
 * Get retention cleanup statistics without deleting.
 */
export async function getRetentionStats(
  db: Database,
  retentionDays = DEFAULT_RETENTION_DAYS
): Promise<{
  totalNotifications: number;
  expiredNotifications: number;
  retentionDays: number;
  cutoffDate: string;
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffStr = cutoff.toISOString();

  const totalResult: any = await db.execute(sql`
    SELECT count(*)::int AS count FROM notifications
  `);
  const expiredResult: any = await db.execute(sql`
    SELECT count(*)::int AS count FROM notifications WHERE created_at < ${cutoffStr}
  `);

  const totalRow = totalResult?.rows?.[0] ?? (Array.isArray(totalResult) ? totalResult[0] : totalResult);
  const expiredRow = expiredResult?.rows?.[0] ?? (Array.isArray(expiredResult) ? expiredResult[0] : expiredResult);

  return {
    totalNotifications: Number(totalRow?.count || 0),
    expiredNotifications: Number(expiredRow?.count || 0),
    retentionDays,
    cutoffDate: cutoff.toISOString(),
  };
}
