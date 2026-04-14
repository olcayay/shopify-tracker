import { pgTable, uuid, varchar, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { accounts } from "./auth.js";

// Per-account platform subscription (capped by accounts.max_platforms). Presence of a row
// means the account is entitled to the platform; actual access is gated by the
// `feature_flags.platform-<id>` 3-tier check (global / account / user) — see
// apps/api/src/utils/platform-visibility.ts. The legacy `override_global_visibility`
// column was dropped in migration 0150; account-level early access is now an
// `account_feature_flags` row.
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
