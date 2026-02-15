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
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => trackedKeywords.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_account_tracked_keywords_unique").on(
      table.accountId,
      table.keywordId
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
    appSlug: varchar("app_slug", { length: 255 })
      .notNull()
      .references(() => apps.slug),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_account_competitor_apps_unique").on(
      table.accountId,
      table.appSlug
    ),
  ]
);
