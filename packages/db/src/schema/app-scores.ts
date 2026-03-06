import {
  pgTable,
  serial,
  integer,
  varchar,
  date,
  smallint,
  decimal,
  timestamp,
  index,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { accounts } from "./auth.js";
import { apps } from "./apps.js";
import { scrapeRuns } from "./scrape-runs.js";

export const appVisibilityScores = pgTable(
  "app_visibility_scores",
  {
    id: serial("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    trackedAppId: integer("tracked_app_id")
      .notNull()
      .references(() => apps.id),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id),
    computedAt: date("computed_at").notNull(),
    scrapeRunId: uuid("scrape_run_id")
      .notNull()
      .references(() => scrapeRuns.id),
    keywordCount: smallint("keyword_count").notNull(),
    visibilityRaw: decimal("visibility_raw", { precision: 12, scale: 4 }).notNull(),
    visibilityScore: smallint("visibility_score").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_app_visibility_unique").on(
      table.accountId, table.trackedAppId, table.appId, table.computedAt,
    ),
    index("idx_app_visibility_app_date").on(table.appId, table.computedAt),
    index("idx_app_visibility_account_tracked").on(
      table.accountId, table.trackedAppId, table.computedAt,
    ),
  ]
);

export const appPowerScores = pgTable(
  "app_power_scores",
  {
    id: serial("id").primaryKey(),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id),
    platform: varchar("platform", { length: 20 }).notNull().default("shopify"),
    categorySlug: varchar("category_slug", { length: 255 }).notNull(),
    computedAt: date("computed_at").notNull(),
    scrapeRunId: uuid("scrape_run_id")
      .notNull()
      .references(() => scrapeRuns.id),
    ratingScore: decimal("rating_score", { precision: 5, scale: 4 }).notNull(),
    reviewScore: decimal("review_score", { precision: 5, scale: 4 }).notNull(),
    categoryScore: decimal("category_score", { precision: 5, scale: 4 }).notNull(),
    momentumScore: decimal("momentum_score", { precision: 5, scale: 4 }).notNull(),
    powerRaw: decimal("power_raw", { precision: 8, scale: 4 }).notNull(),
    powerScore: smallint("power_score").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_app_power_unique").on(
      table.appId, table.categorySlug, table.computedAt,
    ),
    index("idx_app_power_app_date").on(table.appId, table.computedAt),
    index("idx_app_power_cat_date_score").on(
      table.categorySlug, table.computedAt, table.powerScore,
    ),
  ]
);
