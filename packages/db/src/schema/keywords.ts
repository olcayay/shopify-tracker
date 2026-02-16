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
import type { KeywordSearchApp } from "@shopify-tracking/shared";
import { scrapeRuns } from "./scrape-runs";
import { apps } from "./apps";

export const trackedKeywords = pgTable("tracked_keywords", {
  id: serial("id").primaryKey(),
  keyword: varchar("keyword", { length: 255 }).notNull().unique(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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
    appSlug: varchar("app_slug", { length: 255 })
      .notNull()
      .references(() => apps.slug),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => trackedKeywords.id),
    scrapeRunId: uuid("scrape_run_id")
      .notNull()
      .references(() => scrapeRuns.id),
    scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
    position: smallint("position").notNull(),
  },
  (table) => [
    index("idx_app_kw_rank").on(
      table.appSlug,
      table.keywordId,
      table.scrapedAt
    ),
  ]
);

export const keywordAdSightings = pgTable(
  "keyword_ad_sightings",
  {
    id: serial("id").primaryKey(),
    appSlug: varchar("app_slug", { length: 255 })
      .notNull()
      .references(() => apps.slug),
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
    index("idx_kw_ad_sightings_app_date").on(table.appSlug, table.seenDate),
    uniqueIndex("idx_kw_ad_sightings_unique").on(
      table.appSlug,
      table.keywordId,
      table.seenDate
    ),
  ]
);
