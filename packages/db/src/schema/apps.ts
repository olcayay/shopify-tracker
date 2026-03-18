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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  AppDeveloper,
  AppCategory,
  PricingPlan,
  AppSupport,
} from "@appranks/shared";
import { scrapeRuns } from "./scrape-runs.js";

export const apps = pgTable(
  "apps",
  {
    id: serial("id").primaryKey(),
    platform: varchar("platform", { length: 20 }).notNull().default("shopify"),
    slug: varchar("slug", { length: 255 }).notNull(),
    name: text("name").notNull(),
    isTracked: boolean("is_tracked").notNull().default(false),
    isBuiltForShopify: boolean("is_built_for_shopify").notNull().default(false),
    badges: jsonb("badges").$type<string[]>().notNull().default([]),
    launchedDate: timestamp("launched_date"),
    iconUrl: text("icon_url"),
    appCardSubtitle: text("app_card_subtitle"),
    averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
    ratingCount: integer("rating_count"),
    pricingHint: text("pricing_hint"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    currentVersion: varchar("current_version", { length: 50 }),
    activeInstalls: integer("active_installs"),
    lastUpdatedAt: timestamp("last_updated_at"),
    externalId: varchar("external_id", { length: 100 }),
  },
  (table) => [
    uniqueIndex("idx_apps_platform_slug").on(table.platform, table.slug),
    index("idx_apps_is_tracked").on(table.isTracked),
  ]
);

export const appSnapshots = pgTable(
  "app_snapshots",
  {
    id: serial("id").primaryKey(),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id),
    scrapeRunId: uuid("scrape_run_id")
      .notNull()
      .references(() => scrapeRuns.id),
    scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
    appIntroduction: text("app_introduction").notNull().default(""),
    appDetails: text("app_details").notNull().default(""),
    seoMetaDescription: text("seo_meta_description").notNull().default(""),
    seoTitle: text("seo_title").notNull().default(""),
    features: jsonb("features").$type<string[]>().notNull().default([]),
    pricing: text("pricing").notNull().default(""),
    averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
    ratingCount: integer("rating_count"),
    developer: jsonb("developer").$type<AppDeveloper>(),
    demoStoreUrl: text("demo_store_url"),
    languages: jsonb("languages").$type<string[]>().notNull().default([]),
    integrations: jsonb("integrations").$type<string[]>().notNull().default([]),
    categories: jsonb("categories")
      .$type<AppCategory[]>()
      .notNull()
      .default([]),
    pricingPlans: jsonb("pricing_plans")
      .$type<PricingPlan[]>()
      .notNull()
      .default([]),
    support: jsonb("support").$type<AppSupport>(),
    platformData: jsonb("platform_data")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (table) => [
    index("idx_app_snapshots_app_id_date").on(table.appId, table.scrapedAt),
  ]
);

export const appFieldChanges = pgTable(
  "app_field_changes",
  {
    id: serial("id").primaryKey(),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id),
    field: varchar("field", { length: 50 }).notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    detectedAt: timestamp("detected_at").notNull().defaultNow(),
    scrapeRunId: uuid("scrape_run_id")
      .notNull()
      .references(() => scrapeRuns.id),
  },
  (table) => [
    index("idx_app_field_changes_app_id").on(table.appId, table.detectedAt),
  ]
);

export const appCategoryRankings = pgTable(
  "app_category_rankings",
  {
    id: serial("id").primaryKey(),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id),
    categorySlug: varchar("category_slug", { length: 255 }).notNull(),
    scrapeRunId: uuid("scrape_run_id")
      .notNull()
      .references(() => scrapeRuns.id),
    scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
    position: smallint("position").notNull(),
  },
  (table) => [
    index("idx_app_cat_rank_id").on(
      table.appId,
      table.categorySlug,
      table.scrapedAt
    ),
  ]
);
