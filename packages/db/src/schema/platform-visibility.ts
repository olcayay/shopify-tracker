import { pgTable, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

export const platformVisibility = pgTable("platform_visibility", {
  platform: varchar("platform", { length: 20 }).primaryKey(),
  isVisible: boolean("is_visible").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
