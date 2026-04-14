import { pgTable, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

// Platform launch state moved to feature_flags.platform-<id> (single source of truth,
// 3-tier: global / account / user) in migration 0148. This table only tracks the
// scraper toggle now (whether the worker runs for that platform — unrelated to UI access).
export const platformVisibility = pgTable("platform_visibility", {
  platform: varchar("platform", { length: 20 }).primaryKey(),
  scraperEnabled: boolean("scraper_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
