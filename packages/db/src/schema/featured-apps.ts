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
import { apps } from "./apps";
import { scrapeRuns } from "./scrape-runs";

export const featuredAppSightings = pgTable(
  "featured_app_sightings",
  {
    id: serial("id").primaryKey(),
    appSlug: varchar("app_slug", { length: 255 })
      .notNull()
      .references(() => apps.slug),
    surface: varchar("surface", { length: 50 }).notNull(),
    surfaceDetail: varchar("surface_detail", { length: 255 }).notNull(),
    sectionHandle: varchar("section_handle", { length: 255 }).notNull(),
    sectionTitle: varchar("section_title", { length: 500 }),
    position: smallint("position"),
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
    index("idx_featured_surface_date").on(
      table.surface,
      table.surfaceDetail,
      table.seenDate
    ),
    index("idx_featured_app_date").on(table.appSlug, table.seenDate),
    uniqueIndex("idx_featured_unique").on(
      table.appSlug,
      table.sectionHandle,
      table.surfaceDetail,
      table.seenDate
    ),
  ]
);
