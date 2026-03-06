import { pgTable, uuid, varchar, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { accounts } from "./auth.js";

export const accountPlatforms = pgTable(
  "account_platforms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 20 }).notNull(),
    enabledAt: timestamp("enabled_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_account_platforms_unique").on(table.accountId, table.platform),
  ]
);
