import {
  pgTable,
  serial,
  varchar,
  boolean,
  timestamp,
  uuid,
  integer,
  jsonb,
  smallint,
  index,
  uniqueIndex,
  date,
} from "drizzle-orm/pg-core";
import type { KeywordSearchApp } from "@appranks/shared";
import { scrapeRuns } from "./scrape-runs.js";
import { apps } from "./apps.js";

export const trackedKeywords = pgTable(
  "tracked_keywords",
  {
    id: serial("id").primaryKey(),
    platform: varchar("platform", { length: 20 }).notNull().default("shopify"),
    keyword: varchar("keyword", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_tracked_keywords_platform_keyword").on(table.platform, table.keyword),
  ]
);

/** Generate a URL-safe slug from a keyword text */
export function keywordToSlug(keyword: string): string {
  return keyword
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const keywordSnapshots = pgTable(
  "keyword_snapshots",
  {
    id: serial("id").primaryKey(),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => trackedKeywords.id),
    scrapeRunId: uuid("scrape_run_id")
      .notNull()
      .references(() => scrapeRuns.id),
    scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
    totalResults: integer("total_results"),
    results: jsonb("results")
      .$type<KeywordSearchApp[]>()
      .notNull()
      .default([]),
  },
  (table) => [
    index("idx_keyword_snapshots_kw_date").on(
      table.keywordId,
      table.scrapedAt
    ),
  ]
);

export const appKeywordRankings = pgTable(
  "app_keyword_rankings",
  {
    id: serial("id").primaryKey(),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => trackedKeywords.id),
    scrapeRunId: uuid("scrape_run_id")
      .notNull()
      .references(() => scrapeRuns.id),
    scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
    position: smallint("position"),
  },
  (table) => [
    index("idx_app_kw_rank").on(
      table.appId,
      table.keywordId,
      table.scrapedAt
    ),
  ]
);

export const keywordAutoSuggestions = pgTable(
  "keyword_auto_suggestions",
  {
    id: serial("id").primaryKey(),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => trackedKeywords.id),
    suggestions: jsonb("suggestions")
      .$type<string[]>()
      .notNull()
      .default([]),
    scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
    scrapeRunId: uuid("scrape_run_id").references(() => scrapeRuns.id),
  },
  (table) => [
    uniqueIndex("idx_kw_auto_suggestions_kw").on(table.keywordId),
  ]
);

export const keywordAdSightings = pgTable(
  "keyword_ad_sightings",
  {
    id: serial("id").primaryKey(),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => trackedKeywords.id),
    seenDate: date("seen_date", { mode: "string" }).notNull(),
    firstSeenRunId: uuid("first_seen_run_id")
      .notNull()
      .references(() => scrapeRuns.id),
    lastSeenRunId: uuid("last_seen_run_id")
      .notNull()
      .references(() => scrapeRuns.id),
    timesSeenInDay: smallint("times_seen_in_day").notNull().default(1),
  },
  (table) => [
    index("idx_kw_ad_sightings_kw_date").on(table.keywordId, table.seenDate),
    index("idx_kw_ad_sightings_app_date").on(table.appId, table.seenDate),
    uniqueIndex("idx_kw_ad_sightings_unique").on(
      table.appId,
      table.keywordId,
      table.seenDate
    ),
  ]
);
