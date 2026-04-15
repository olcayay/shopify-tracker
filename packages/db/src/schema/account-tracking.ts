import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { accounts } from "./auth.js";
import { apps } from "./apps.js";
import { trackedKeywords } from "./keywords.js";
import { categories } from "./categories.js";
import { globalDevelopers } from "./developers.js";

export const accountTrackedFeatures = pgTable(
  "account_tracked_features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    featureHandle: varchar("feature_handle", { length: 255 }).notNull(),
    featureTitle: varchar("feature_title", { length: 500 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_account_tracked_features_unique").on(
      table.accountId,
      table.featureHandle
    ),
  ]
);

export const accountTrackedApps = pgTable(
  "account_tracked_apps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_account_tracked_apps_unique").on(
      table.accountId,
      table.appId
    ),
  ]
);

export const accountTrackedKeywords = pgTable(
  "account_tracked_keywords",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    trackedAppId: integer("tracked_app_id")
      .references(() => apps.id),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => trackedKeywords.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_account_tracked_keywords_unique").on(
      table.accountId,
      table.trackedAppId,
      table.keywordId
    ),
    index("idx_account_tracked_keywords_app").on(table.trackedAppId),
  ]
);

export const accountStarredCategories = pgTable(
  "account_starred_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_account_starred_categories_unique").on(
      table.accountId,
      table.categoryId
    ),
  ]
);

export const accountStarredDevelopers = pgTable(
  "account_starred_developers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    globalDeveloperId: integer("global_developer_id")
      .notNull()
      .references(() => globalDevelopers.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_account_starred_developers_unique").on(
      table.accountId,
      table.globalDeveloperId
    ),
  ]
);

export const accountCompetitorApps = pgTable(
  "account_competitor_apps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    trackedAppId: integer("tracked_app_id")
      .notNull()
      .references(() => apps.id),
    competitorAppId: integer("competitor_app_id")
      .notNull()
      .references(() => apps.id),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_account_competitor_apps_unique").on(
      table.accountId,
      table.trackedAppId,
      table.competitorAppId
    ),
    index("idx_account_competitor_apps_tracked").on(table.trackedAppId),
    index("idx_account_competitor_apps_account_competitor").on(
      table.accountId,
      table.competitorAppId
    ),
  ]
);
