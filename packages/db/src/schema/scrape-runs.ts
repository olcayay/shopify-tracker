import { pgTable, uuid, pgEnum, timestamp, jsonb, text, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const scraperTypeEnum = pgEnum("scraper_type", [
  "category",
  "app_details",
  "keyword_search",
  "keyword_suggestions",
  "reviews",
  "daily_digest",
  "featured_apps",
  "compute_review_metrics",
  "compute_similarity_scores",
  "backfill_categories",
  "compute_app_scores",
  "weekly_summary",
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
    platform: varchar("platform", { length: 20 }),
    jobId: varchar("job_id", { length: 50 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    triggeredBy: varchar("triggered_by", { length: 255 }),
    queue: varchar("queue", { length: 20 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    error: text("error"),
    /** PLA-1066: pointer to the original run when this row was created by a
     *  BullMQ stall-retry of an existing jobId. NULL on first attempts. */
    parentRunId: uuid("parent_run_id"),
    /** PLA-1081 follow-up: auto-updated to now() by the DB trigger
     *  `tr_scrape_runs_touch_last_progress` on any UPDATE that mutates
     *  `metadata` for a running row. Lets cleanupStaleRuns flip a row
     *  only when progress has genuinely stalled, not just because a long
     *  run exceeded a fixed time budget. */
    lastProgressAt: timestamp("last_progress_at").defaultNow(),
  },
  (table) => [
    index("idx_scrape_runs_type_started").on(table.scraperType, table.startedAt),
    index("idx_scrape_runs_status").on(table.status),
    index("idx_scrape_runs_platform_type_started").on(table.platform, table.scraperType, table.startedAt),
    index("idx_scrape_runs_parent_run_id").on(table.parentRunId),
    /** PLA-1064: defense-in-depth against duplicate scrape_runs rows for the
     *  same BullMQ job. Partial — scheduler-internal rows with no jobId are
     *  exempt. Created CONCURRENTLY in migration 0145. */
    uniqueIndex("uniq_scrape_runs_queue_jobid_startedat")
      .on(table.queue, table.jobId, table.startedAt)
      .where(sql`${table.jobId} IS NOT NULL`),
  ]
);
