import {
  pgTable,
  serial,
  varchar,
  boolean,
  timestamp,
  uuid,
  text,
  decimal,
  integer,
  jsonb,
  smallint,
  index,
} from "drizzle-orm/pg-core";
import type {
  AppDeveloper,
  AppCategory,
  PricingTier,
} from "@shopify-tracking/shared";
import { scrapeRuns } from "./scrape-runs";

export const apps = pgTable(
  "apps",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 500 }).notNull(),
    isTracked: boolean("is_tracked").notNull().default(false),
    isBuiltForShopify: boolean("is_built_for_shopify").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_apps_is_tracked").on(table.isTracked),
  ]
);

export const appSnapshots = pgTable(
  "app_snapshots",
  {
    id: serial("id").primaryKey(),
    appSlug: varchar("app_slug", { length: 255 })
      .notNull()
      .references(() => apps.slug),
    scrapeRunId: uuid("scrape_run_id")
      .notNull()
      .references(() => scrapeRuns.id),
    scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
    title: varchar("title", { length: 500 }).notNull().default(""),
    description: text("description").notNull().default(""),
    pricing: varchar("pricing", { length: 500 }).notNull().default(""),
    averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
    ratingCount: integer("rating_count"),
    developer: jsonb("developer").$type<AppDeveloper>(),
    demoStoreUrl: varchar("demo_store_url", { length: 500 }),
    languages: jsonb("languages").$type<string[]>().notNull().default([]),
    worksWith: jsonb("works_with").$type<string[]>().notNull().default([]),
    categories: jsonb("categories")
      .$type<AppCategory[]>()
      .notNull()
      .default([]),
    pricingTiers: jsonb("pricing_tiers")
      .$type<PricingTier[]>()
      .notNull()
      .default([]),
  },
  (table) => [
    index("idx_app_snapshots_slug_date").on(table.appSlug, table.scrapedAt),
  ]
);

export const appCategoryRankings = pgTable(
  "app_category_rankings",
  {
    id: serial("id").primaryKey(),
    appSlug: varchar("app_slug", { length: 255 })
      .notNull()
      .references(() => apps.slug),
    categorySlug: varchar("category_slug", { length: 255 }).notNull(),
    scrapeRunId: uuid("scrape_run_id")
      .notNull()
      .references(() => scrapeRuns.id),
    scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
    position: smallint("position").notNull(),
  },
  (table) => [
    index("idx_app_cat_rank").on(
      table.appSlug,
      table.categorySlug,
      table.scrapedAt
    ),
  ]
);
