import {
  pgTable,
  serial,
  varchar,
  smallint,
  text,
  boolean,
  timestamp,
  uuid,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import type { FirstPageMetrics, FirstPageApp } from "@shopify-tracking/shared";
import { scrapeRuns } from "./scrape-runs.js";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 500 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  parentSlug: varchar("parent_slug", { length: 255 }),
  categoryLevel: smallint("category_level").notNull(),
  description: text("description").notNull().default(""),
  isTracked: boolean("is_tracked").notNull().default(true),
  isListingPage: boolean("is_listing_page").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const categorySnapshots = pgTable(
  "category_snapshots",
  {
    id: serial("id").primaryKey(),
    categorySlug: varchar("category_slug", { length: 255 })
      .notNull()
      .references(() => categories.slug),
    scrapeRunId: uuid("scrape_run_id")
      .notNull()
      .references(() => scrapeRuns.id),
    scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
    dataSourceUrl: varchar("data_source_url", { length: 500 }).notNull(),
    appCount: integer("app_count"),
    firstPageMetrics: jsonb("first_page_metrics").$type<FirstPageMetrics>(),
    firstPageApps: jsonb("first_page_apps")
      .$type<FirstPageApp[]>()
      .notNull()
      .default([]),
    breadcrumb: text("breadcrumb").notNull().default(""),
  },
  (table) => [
    index("idx_category_snapshots_slug_date").on(
      table.categorySlug,
      table.scrapedAt
    ),
  ]
);
