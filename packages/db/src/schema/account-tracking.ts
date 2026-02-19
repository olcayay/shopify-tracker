import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { accounts } from "./auth";
import { apps } from "./apps";
import { trackedKeywords } from "./keywords";
import { categories } from "./categories";

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
    appSlug: varchar("app_slug", { length: 255 })
      .notNull()
      .references(() => apps.slug),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_account_tracked_apps_unique").on(
      table.accountId,
      table.appSlug
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
    trackedAppSlug: varchar("tracked_app_slug", { length: 255 })
      .notNull()
      .references(() => apps.slug),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => trackedKeywords.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_account_tracked_keywords_unique").on(
      table.accountId,
      table.trackedAppSlug,
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
    categorySlug: varchar("category_slug", { length: 255 })
      .notNull()
      .references(() => categories.slug),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_account_starred_categories_unique").on(
      table.accountId,
      table.categorySlug
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
    trackedAppSlug: varchar("tracked_app_slug", { length: 255 })
      .notNull()
      .references(() => apps.slug),
    appSlug: varchar("app_slug", { length: 255 })
      .notNull()
      .references(() => apps.slug),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_account_competitor_apps_unique").on(
      table.accountId,
      table.trackedAppSlug,
      table.appSlug
    ),
  ]
);
