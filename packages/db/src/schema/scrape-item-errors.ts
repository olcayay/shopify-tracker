import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { scrapeRuns } from "./scrape-runs.js";

export const scrapeItemErrors = pgTable(
  "scrape_item_errors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scrapeRunId: uuid("scrape_run_id")
      .notNull()
      .references(() => scrapeRuns.id),
    itemIdentifier: varchar("item_identifier", { length: 255 }).notNull(),
    itemType: varchar("item_type", { length: 50 }).notNull(),
    url: varchar("url", { length: 1024 }),
    errorMessage: varchar("error_message", { length: 2048 }).notNull(),
    stackTrace: text("stack_trace"),
    linearIssueId: varchar("linear_issue_id", { length: 50 }),
    linearIssueUrl: varchar("linear_issue_url", { length: 512 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_scrape_item_errors_run_id").on(table.scrapeRunId),
    index("idx_scrape_item_errors_identifier").on(table.itemIdentifier),
  ]
);
