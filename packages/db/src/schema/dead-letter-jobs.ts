import { pgTable, serial, varchar, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const deadLetterJobs = pgTable(
  "dead_letter_jobs",
  {
    id: serial("id").primaryKey(),
    jobId: varchar("job_id", { length: 255 }).notNull(),
    queueName: varchar("queue_name", { length: 100 }).notNull(),
    jobType: varchar("job_type", { length: 100 }).notNull(),
    platform: varchar("platform", { length: 50 }),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    errorMessage: text("error_message"),
    errorStack: text("error_stack"),
    attemptsMade: integer("attempts_made").notNull().default(0),
    failedAt: timestamp("failed_at", { withTimezone: true }).notNull().defaultNow(),
    replayedAt: timestamp("replayed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_dlj_job_type").on(table.jobType),
    index("idx_dlj_failed_at").on(table.failedAt),
    index("idx_dlj_platform").on(table.platform),
  ]
);
