import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { accounts, users } from "./auth.js";

/** Global feature flag definitions */
export const featureFlags = pgTable(
  "feature_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    isEnabled: boolean("is_enabled").notNull().default(false),
    activatedAt: timestamp("activated_at"),
    deactivatedAt: timestamp("deactivated_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_feature_flags_slug").on(table.slug),
  ]
);

/** Per-account feature flag enablement overrides */
export const accountFeatureFlags = pgTable(
  "account_feature_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    featureFlagId: uuid("feature_flag_id")
      .notNull()
      .references(() => featureFlags.id, { onDelete: "cascade" }),
    enabledAt: timestamp("enabled_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_account_feature_flags_unique").on(table.accountId, table.featureFlagId),
    index("idx_account_feature_flags_account").on(table.accountId),
    index("idx_account_feature_flags_flag").on(table.featureFlagId),
  ]
);

/** Per-user feature flag overrides (takes precedence over account-level) */
export const userFeatureFlags = pgTable(
  "user_feature_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    featureFlagId: uuid("feature_flag_id")
      .notNull()
      .references(() => featureFlags.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    enabledAt: timestamp("enabled_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_user_feature_flags_unique").on(table.userId, table.featureFlagId),
    index("idx_user_feature_flags_user").on(table.userId),
    index("idx_user_feature_flags_flag").on(table.featureFlagId),
  ]
);
