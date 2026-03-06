import {
  pgTable,
  serial,
  integer,
  date,
  text,
  smallint,
  uuid,
  timestamp,
  uniqueIndex,
  index,
  varchar,
} from "drizzle-orm/pg-core";
import { apps } from "./apps.js";
import { scrapeRuns } from "./scrape-runs.js";

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id),
    reviewDate: date("review_date").notNull(),
    content: text("content").notNull().default(""),
    reviewerName: varchar("reviewer_name", { length: 500 }).notNull(),
    reviewerCountry: varchar("reviewer_country", { length: 255 }),
    durationUsingApp: varchar("duration_using_app", { length: 255 }),
    rating: smallint("rating").notNull(),
    developerReplyDate: date("developer_reply_date"),
    developerReplyText: text("developer_reply_text"),
    firstSeenRunId: uuid("first_seen_run_id").references(() => scrapeRuns.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_reviews_dedup").on(
      table.appId,
      table.reviewerName,
    ),
    index("idx_reviews_app_date").on(table.appId, table.reviewDate),
  ]
);
