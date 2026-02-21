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

export const similarAppSightings = pgTable(
  "similar_app_sightings",
  {
    id: serial("id").primaryKey(),
    appSlug: varchar("app_slug", { length: 255 })
      .notNull()
      .references(() => apps.slug),
    similarAppSlug: varchar("similar_app_slug", { length: 255 })
      .notNull()
      .references(() => apps.slug),
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
    index("idx_similar_sightings_app_date").on(table.appSlug, table.seenDate),
    index("idx_similar_sightings_similar_date").on(
      table.similarAppSlug,
      table.seenDate
    ),
    uniqueIndex("idx_similar_sightings_unique").on(
      table.appSlug,
      table.similarAppSlug,
      table.seenDate
    ),
  ]
);
