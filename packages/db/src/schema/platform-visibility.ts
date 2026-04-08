import { pgTable, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

export const platformVisibility = pgTable("platform_visibility", {
  platform: varchar("platform", { length: 20 }).primaryKey(),
  isVisible: boolean("is_visible").notNull().default(false),
  scraperEnabled: boolean("scraper_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
