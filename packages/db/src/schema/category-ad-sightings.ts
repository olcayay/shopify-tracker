import {
  pgTable,
  serial,
  varchar,
  smallint,
  date,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { apps } from "./apps.js";
import { categories } from "./categories.js";
import { scrapeRuns } from "./scrape-runs.js";

export const categoryAdSightings = pgTable(
  "category_ad_sightings",
  {
    id: serial("id").primaryKey(),
    appSlug: varchar("app_slug", { length: 255 })
      .notNull()
      .references(() => apps.slug),
    categorySlug: varchar("category_slug", { length: 255 })
      .notNull()
      .references(() => categories.slug),
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
    index("idx_cat_ad_sightings_cat_date").on(
      table.categorySlug,
      table.seenDate
    ),
    index("idx_cat_ad_sightings_app_date").on(table.appSlug, table.seenDate),
    uniqueIndex("idx_cat_ad_sightings_unique").on(
      table.appSlug,
      table.categorySlug,
      table.seenDate
    ),
  ]
);
