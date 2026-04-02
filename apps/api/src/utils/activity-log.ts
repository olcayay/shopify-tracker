/**
 * Log an account activity. Fire-and-forget — never throws.
 * Uses setTimeout to ensure it never blocks or affects the calling handler.
 */
export function logActivity(
  db: any,
  accountId: string,
  userId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  _metadata?: Record<string, unknown>,
): void {
  setTimeout(() => {
    try {
      import("drizzle-orm").then(({ sql }) => {
        db.execute(sql`
          INSERT INTO account_activity_log (account_id, user_id, action, entity_type, entity_id)
          VALUES (${accountId}, ${userId}, ${action}, ${entityType ?? null}, ${entityId ?? null})
        `).catch(() => {});
      }).catch(() => {});
    } catch {
      // Never throw
    }
  }, 0);
}
