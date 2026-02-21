import { pgTable, uuid, pgEnum, timestamp, jsonb, text, varchar, index } from "drizzle-orm/pg-core";

export const scraperTypeEnum = pgEnum("scraper_type", [
  "category",
  "app_details",
  "keyword_search",
  "keyword_suggestions",
  "reviews",
  "daily_digest",
]);

export const scrapeRunStatusEnum = pgEnum("scrape_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const scrapeRuns = pgTable(
  "scrape_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scraperType: scraperTypeEnum("scraper_type").notNull(),
    status: scrapeRunStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    triggeredBy: varchar("triggered_by", { length: 255 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    error: text("error"),
  },
  (table) => [
    index("idx_scrape_runs_type_started").on(table.scraperType, table.startedAt),
    index("idx_scrape_runs_status").on(table.status),
  ]
);
