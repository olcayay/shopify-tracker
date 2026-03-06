import {
  pgTable,
  serial,
  integer,
  smallint,
  date,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { apps } from "./apps.js";
import { scrapeRuns } from "./scrape-runs.js";

export const similarAppSightings = pgTable(
  "similar_app_sightings",
  {
    id: serial("id").primaryKey(),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id),
    similarAppId: integer("similar_app_id")
      .notNull()
      .references(() => apps.id),
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
    index("idx_similar_sightings_app_date").on(table.appId, table.seenDate),
    index("idx_similar_sightings_similar_date").on(
      table.similarAppId,
      table.seenDate
    ),
    uniqueIndex("idx_similar_sightings_unique").on(
      table.appId,
      table.similarAppId,
      table.seenDate
    ),
  ]
);
