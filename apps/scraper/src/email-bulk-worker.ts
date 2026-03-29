import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });

import * as Sentry from "@sentry/node";
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1,
  });
}

import { Worker } from "bullmq";
import type { BulkEmailJobData } from "@appranks/shared";
import { createLogger } from "@appranks/shared";
import { createDb, deadLetterJobs } from "@appranks/db";
import { EMAIL_BULK_QUEUE_NAME, getRedisConnection } from "./queue.js";
import { processBulkEmail } from "./email/process-bulk-email.js";

const log = createLogger("email-bulk-worker");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  log.error("DATABASE_URL environment variable is required");
  process.exit(1);
}
const db = createDb(databaseUrl);

const worker = new Worker<BulkEmailJobData>(
  EMAIL_BULK_QUEUE_NAME,
  (job) => processBulkEmail(job, db),
  {
    connection: getRedisConnection(),
    concurrency: 5,
    limiter: {
      max: 50,
      duration: 60_000, // 50 jobs per minute
    },
  }
);

worker.on("failed", async (job, err) => {
  log.error("bulk email job failed", {
    jobId: job?.id,
    type: job?.data?.type,
    to: job?.data?.to,
    attempt: job?.attemptsMade,
    error: String(err),
  });

  // After final failure, log to dead letter table
  if (job && job.attemptsMade >= (job.opts?.attempts ?? 2)) {
    try {
      await db.insert(deadLetterJobs).values({
        jobId: job.id ?? "unknown",
        queueName: EMAIL_BULK_QUEUE_NAME,
        jobType: job.data.type,
        payload: job.data as unknown as Record<string, unknown>,
        errorMessage: String(err),
        errorStack: err instanceof Error ? err.stack : undefined,
        attemptsMade: job.attemptsMade,
      });
      log.info("job moved to dead letter queue", { jobId: job.id, type: job.data.type });
    } catch (dlErr) {
      log.error("failed to insert dead letter job", { error: String(dlErr) });
    }
  }
});

worker.on("error", (err) => {
  log.error("worker error", { error: String(err) });
});

log.info("email-bulk worker started (concurrency: 5, rate: 50/min), waiting for jobs...");

// Graceful shutdown with 120s grace for in-flight emails
const shutdown = async () => {
  log.info("shutting down email-bulk worker (120s grace period)...");
  await worker.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
