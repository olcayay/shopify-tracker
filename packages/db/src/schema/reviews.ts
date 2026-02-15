import {
  pgTable,
  serial,
  varchar,
  date,
  text,
  smallint,
  uuid,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { apps } from "./apps";
import { scrapeRuns } from "./scrape-runs";

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    appSlug: varchar("app_slug", { length: 255 })
      .notNull()
      .references(() => apps.slug),
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
      table.appSlug,
      table.reviewerName,
      table.reviewDate,
      table.rating
    ),
    index("idx_reviews_app_date").on(table.appSlug, table.reviewDate),
  ]
);
