import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { accounts } from "./auth.js";
import { apps } from "./apps.js";
import { trackedKeywords } from "./keywords.js";
import { categories } from "./categories.js";

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
      .notNull()
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
  ]
);
