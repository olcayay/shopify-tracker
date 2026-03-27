import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { accounts } from "./auth.js";
import { users } from "./auth.js";

export const platformRequests = pgTable(
  "platform_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platformName: varchar("platform_name", { length: 100 }).notNull(),
    marketplaceUrl: varchar("marketplace_url", { length: 500 }),
    notes: text("notes"),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_platform_requests_account").on(table.accountId),
    index("idx_platform_requests_status").on(table.status),
  ]
);
