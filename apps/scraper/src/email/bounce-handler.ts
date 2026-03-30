/**
 * Email bounce and complaint handler (PLA-428).
 *
 * Tracks hard bounces and spam complaints to protect domain reputation.
 * Suppresses future sends to bounced/complained addresses.
 */
import { eq, and, sql, gte } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { emailLogs } from "@appranks/db";
import { createLogger } from "@appranks/shared";

const log = createLogger("bounce-handler");

export type BounceType = "hard" | "soft" | "complaint";

export interface BounceEvent {
  email: string;
  bounceType: BounceType;
  messageId?: string;
  diagnosticCode?: string;
  timestamp?: Date;
}

// In-memory suppression list (refreshed periodically)
const suppressionSet = new Set<string>();
let lastRefreshed = 0;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Record a bounce or complaint event.
 * Hard bounces and complaints immediately suppress the address.
 */
export async function recordBounce(db: Database, event: BounceEvent): Promise<void> {
  log.info(`bounce recorded: ${event.email} (${event.bounceType})`, { email: event.email, type: event.bounceType, diagnostic: event.diagnosticCode });

  // Update the email log entry if messageId is provided
  if (event.messageId) {
    await db
      .update(emailLogs)
      .set({
        status: event.bounceType === "complaint" ? "complained" : "bounced",
        errorMessage: event.diagnosticCode || `${event.bounceType} bounce`,
      })
      .where(eq(emailLogs.messageId, event.messageId));
  }

  // For hard bounces and complaints, add to suppression
  if (event.bounceType === "hard" || event.bounceType === "complaint") {
    suppressionSet.add(event.email.toLowerCase());
  }
}

/**
 * Check if an email address is suppressed (bounced or complained).
 * Uses in-memory cache with periodic DB refresh.
 */
export async function isSuppressed(db: Database, email: string): Promise<boolean> {
  // Check in-memory first
  if (suppressionSet.has(email.toLowerCase())) return true;

  // Refresh from DB if stale
  const now = Date.now();
  if (now - lastRefreshed > REFRESH_INTERVAL_MS) {
    await refreshSuppressionList(db);
  }

  return suppressionSet.has(email.toLowerCase());
}

/**
 * Refresh the in-memory suppression list from DB.
 * Finds all addresses with hard bounces or complaints in the last 90 days.
 */
export async function refreshSuppressionList(db: Database): Promise<number> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const bounced: any[] = await db.execute(sql`
    SELECT DISTINCT recipient_email
    FROM email_logs
    WHERE (status = 'bounced' OR status = 'complained')
      AND created_at >= ${cutoff}
  `);

  const rows = (bounced as any).rows ?? bounced;
  suppressionSet.clear();
  for (const row of rows) {
    if (row.recipient_email) {
      suppressionSet.add(row.recipient_email.toLowerCase());
    }
  }

  lastRefreshed = Date.now();
  log.info(`suppression list refreshed: ${suppressionSet.size} entries`, { count: suppressionSet.size });
  return suppressionSet.size;
}

/**
 * Get bounce statistics for the last N days.
 */
export async function getBounceStats(db: Database, days: number = 30): Promise<{
  hardBounces: number;
  softBounces: number;
  complaints: number;
  suppressedCount: number;
}> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [stats]: any[] = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'bounced' AND error_message LIKE '%hard%') AS hard_bounces,
      COUNT(*) FILTER (WHERE status = 'bounced' AND (error_message NOT LIKE '%hard%' OR error_message IS NULL)) AS soft_bounces,
      COUNT(*) FILTER (WHERE status = 'complained') AS complaints
    FROM email_logs
    WHERE (status = 'bounced' OR status = 'complained')
      AND created_at >= ${cutoff}
  `);

  const row = (stats as any)?.rows?.[0] ?? stats;
  return {
    hardBounces: Number(row?.hard_bounces || 0),
    softBounces: Number(row?.soft_bounces || 0),
    complaints: Number(row?.complaints || 0),
    suppressedCount: suppressionSet.size,
  };
}
