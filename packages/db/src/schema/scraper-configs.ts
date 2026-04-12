import { pgTable, uuid, text, boolean, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Per-(platform, scraper_type) runtime configuration overrides.
 *
 * Each row stores a JSONB patch (`overrides`) applied on top of the code-level
 * defaults (platform constants + cross-cutting constants) at job start. An empty
 * object means "use all code defaults". Admin editing is gated by the schema
 * registry (`apps/scraper/src/config-schema.ts`) — unknown keys are ignored.
 *
 * `enabled=false` disables that specific (platform, scraper_type) combination
 * without touching the platform-wide `platform_visibility.scraper_enabled` kill
 * switch.
 */
export const scraperConfigs = pgTable(
  "scraper_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platform: text("platform").notNull(),
    scraperType: text("scraper_type").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    overrides: jsonb("overrides").notNull().default(sql`'{}'::jsonb`),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: text("updated_by"),
  },
  (table) => ({
    uniqPlatformType: uniqueIndex("scraper_configs_platform_type_uq").on(table.platform, table.scraperType),
    platformIdx: index("idx_scraper_configs_platform").on(table.platform),
  })
);

export type ScraperConfigRow = typeof scraperConfigs.$inferSelect;
export type ScraperConfigInsert = typeof scraperConfigs.$inferInsert;
