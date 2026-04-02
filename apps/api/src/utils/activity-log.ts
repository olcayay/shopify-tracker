import { accountActivityLog, type Database } from "@appranks/db";

/**
 * Log an account activity. Fire-and-forget — never throws.
 */
export function logActivity(
  db: Database,
  accountId: string,
  userId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
): void {
  db.insert(accountActivityLog)
    .values({ accountId, userId, action, entityType, entityId, metadata })
    .then(() => {})
    .catch(() => {});
}
