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
  metadata?: Record<string, unknown>,
): void {
  setTimeout(() => {
    try {
      import("drizzle-orm").then(({ sql }) => {
        const metadataJson = metadata ? JSON.stringify(metadata) : null;
        db.execute(sql`
          INSERT INTO account_activity_log (account_id, user_id, action, entity_type, entity_id, metadata)
          VALUES (${accountId}, ${userId}, ${action}, ${entityType ?? null}, ${entityId ?? null}, ${metadataJson}::jsonb)
        `).catch(() => {});
      }).catch(() => {});
    } catch {
      // Never throw
    }
  }, 0);
}
