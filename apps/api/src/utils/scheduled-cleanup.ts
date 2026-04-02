import { sql } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { createLogger } from "@appranks/shared";

const log = createLogger("api:cleanup");

/** Run cleanup every 6 hours */
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Delete expired/stale records from auth and email tables.
 * Runs periodically to prevent unbounded table growth.
 */
async function runCleanup(db: Database): Promise<void> {
  try {
    // 1. Expired refresh tokens (expired > 1 day ago)
    const refreshResult = await db.execute(
      sql`DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '1 day'`
    );
    const refreshCount = (refreshResult as any)?.rowCount ?? (refreshResult as any)?.length ?? 0;

    // 2. Expired/used password reset tokens
    const resetResult = await db.execute(
      sql`DELETE FROM password_reset_tokens WHERE expires_at < NOW() - INTERVAL '1 day' OR (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '7 days')`
    );
    const resetCount = (resetResult as any)?.rowCount ?? (resetResult as any)?.length ?? 0;

    // 3. Expired invitations (not accepted, expired > 30 days ago)
    const inviteResult = await db.execute(
      sql`DELETE FROM invitations WHERE expires_at < NOW() - INTERVAL '30 days' AND accepted_at IS NULL`
    );
    const inviteCount = (inviteResult as any)?.rowCount ?? (inviteResult as any)?.length ?? 0;

    // 4. Old email logs (> 90 days)
    const emailResult = await db.execute(
      sql`DELETE FROM email_logs WHERE created_at < NOW() - INTERVAL '90 days'`
    );
    const emailCount = (emailResult as any)?.rowCount ?? (emailResult as any)?.length ?? 0;

    const total = refreshCount + resetCount + inviteCount + emailCount;
    if (total > 0) {
      log.info("Scheduled cleanup completed", {
        refreshTokens: refreshCount,
        passwordResetTokens: resetCount,
        invitations: inviteCount,
        emailLogs: emailCount,
      });
    }
  } catch (err) {
    log.error("Scheduled cleanup failed", { error: String(err) });
  }
}

/**
 * Start the periodic cleanup timer.
 * Returns the interval handle (caller can clearInterval if needed).
 */
export function startScheduledCleanup(db: Database): ReturnType<typeof setInterval> {
  // Run once on startup (after 30s delay to let everything initialize)
  setTimeout(() => runCleanup(db), 30_000);

  // Then every 6 hours
  const interval = setInterval(() => runCleanup(db), CLEANUP_INTERVAL_MS);
  interval.unref();
  return interval;
}
