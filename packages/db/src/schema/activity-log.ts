import { pgTable, uuid, varchar, timestamp, jsonb, index, serial } from "drizzle-orm/pg-core";
import { users, accounts } from "./auth.js";

export const accountActivityLog = pgTable(
  "account_activity_log",
  {
    id: serial("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 50 }).notNull(),
    entityType: varchar("entity_type", { length: 30 }),
    entityId: varchar("entity_id", { length: 255 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_activity_log_account").on(table.accountId, table.createdAt),
  ]
);
