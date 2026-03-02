import { pgTable, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./auth.js";

export const impersonationAuditLogs = pgTable(
  "impersonation_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => users.id),
    targetUserId: uuid("target_user_id")
      .notNull()
      .references(() => users.id),
    action: varchar("action", { length: 20 }).notNull(), // "start" | "stop"
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_impersonation_audit_admin").on(table.adminUserId),
    index("idx_impersonation_audit_target").on(table.targetUserId),
  ]
);
