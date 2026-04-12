import { pgTable, uuid, text, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";

/**
 * Audit log for every mutation to `scraper_configs` (PLA-1043).
 * Populated by the API endpoints in Phase 2+ on every PATCH/DELETE/reset.
 * Used by the scraper-management UI History tab and the run-history
 * "Config snapshot" dialog to answer "who changed what, when, and why".
 */
export const scraperConfigChanges = pgTable(
  "scraper_config_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platform: text("platform").notNull(),
    scraperType: text("scraper_type").notNull(),
    changedAt: timestamp("changed_at").notNull().defaultNow(),
    changedBy: text("changed_by"),
    previousOverrides: jsonb("previous_overrides"),
    newOverrides: jsonb("new_overrides"),
    previousEnabled: boolean("previous_enabled"),
    newEnabled: boolean("new_enabled"),
    reason: text("reason"),
  },
  (table) => ({
    lookupIdx: index("idx_scraper_config_changes_lookup").on(
      table.platform,
      table.scraperType,
      table.changedAt,
    ),
  }),
);

export type ScraperConfigChangeRow = typeof scraperConfigChanges.$inferSelect;
export type ScraperConfigChangeInsert = typeof scraperConfigChanges.$inferInsert;
