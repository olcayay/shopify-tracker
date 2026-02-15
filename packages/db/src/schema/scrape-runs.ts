import { pgTable, uuid, pgEnum, timestamp, jsonb, text, index } from "drizzle-orm/pg-core";

export const scraperTypeEnum = pgEnum("scraper_type", [
  "category",
  "app_details",
  "keyword_search",
  "reviews",
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
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    error: text("error"),
  },
  (table) => [
    index("idx_scrape_runs_type_started").on(table.scraperType, table.startedAt),
    index("idx_scrape_runs_status").on(table.status),
  ]
);
