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

import { Worker, UnrecoverableError } from "bullmq";
import type { InstantEmailJobData } from "@appranks/shared";
import { createLogger } from "@appranks/shared";
import { createDb, deadLetterJobs } from "@appranks/db";
import { EMAIL_INSTANT_QUEUE_NAME, getRedisConnection } from "./queue.js";
import { processInstantEmail } from "./email/process-instant-email.js";
import { classifyEmailError } from "./email/error-classifier.js";

const log = createLogger("email-instant-worker");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  log.error("DATABASE_URL environment variable is required");
  process.exit(1);
}
const db = createDb(databaseUrl);

const worker = new Worker<InstantEmailJobData>(
  EMAIL_INSTANT_QUEUE_NAME,
  async (job) => {
    try {
      await processInstantEmail(job, db);
    } catch (err) {
      const errorClass = classifyEmailError(err);
      log.warn("email send error classified", {
        jobId: job.id,
        type: job.data.type,
        errorClass,
        error: String(err),
      });

      if (errorClass === "permanent") {
        // Permanent errors should not be retried — go straight to DLQ
        throw new UnrecoverableError(
          `Permanent error: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      // For provider_down, we still throw to let BullMQ retry with increased attempts
      // The queue config gives provider_down errors more retry attempts
      throw err;
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 3,
  }
);

worker.on("failed", async (job, err) => {
  const errorClass = classifyEmailError(err);

  log.error("instant email job failed", {
    jobId: job?.id,
    type: job?.data?.type,
    to: job?.data?.to,
    attempt: job?.attemptsMade,
    errorClass,
    error: String(err),
  });

  // After final failure, log to dead letter table
  if (job && job.attemptsMade >= (job.opts?.attempts ?? 3)) {
    try {
      await db.insert(deadLetterJobs).values({
        jobId: job.id ?? "unknown",
        queueName: EMAIL_INSTANT_QUEUE_NAME,
        jobType: job.data.type,
        payload: job.data as unknown as Record<string, unknown>,
        errorMessage: `[${errorClass}] ${String(err)}`,
        errorStack: err instanceof Error ? err.stack : undefined,
        attemptsMade: job.attemptsMade,
      });
      log.info("job moved to dead letter queue", { jobId: job.id, type: job.data.type, errorClass });
    } catch (dlErr) {
      log.error("failed to insert dead letter job", { error: String(dlErr) });
    }
  }
});

worker.on("error", (err) => {
  log.error("worker error", { error: String(err) });
});

log.info("email-instant worker started, waiting for jobs...");

// Graceful shutdown
const shutdown = async () => {
  log.info("shutting down email-instant worker...");
  await worker.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
