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
import type { NotificationJobData } from "@appranks/shared";
import { createLogger } from "@appranks/shared";
import { createDb, deadLetterJobs } from "@appranks/db";
import { NOTIFICATIONS_QUEUE_NAME, getRedisConnection } from "./queue.js";
import { processNotification } from "./notifications/process-notification.js";
import { serializeError, getErrorMessage, getErrorStack } from "./utils/serialize-error.js";

const log = createLogger("notification-worker");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  log.error("DATABASE_URL environment variable is required");
  process.exit(1);
}
const db = createDb(databaseUrl, { max: 2 });

const worker = new Worker<NotificationJobData>(
  NOTIFICATIONS_QUEUE_NAME,
  (job) => processNotification(job, db),
  {
    connection: getRedisConnection(),
    concurrency: 5,
    limiter: {
      max: 100,
      duration: 60_000, // 100 jobs per minute
    },
  }
);

worker.on("failed", async (job, err) => {
  log.error("notification job failed", {
    jobId: job?.id,
    type: job?.data?.type,
    userId: job?.data?.userId,
    attempt: job?.attemptsMade,
    error: serializeError(err),
  });

  if (job && job.attemptsMade >= (job.opts?.attempts ?? 3)) {
    try {
      await db.insert(deadLetterJobs).values({
        jobId: job.id ?? "unknown",
        queueName: NOTIFICATIONS_QUEUE_NAME,
        jobType: job.data.type,
        payload: job.data as unknown as Record<string, unknown>,
        errorMessage: getErrorMessage(err),
        errorStack: getErrorStack(err),
        attemptsMade: job.attemptsMade,
      });
      log.info("job moved to dead letter queue", { jobId: job.id, type: job.data.type });
    } catch (dlErr) {
      log.error("failed to insert dead letter job", { error: serializeError(dlErr) });
    }
  }
});

worker.on("error", (err) => {
  log.error("worker error", { error: serializeError(err) });
});

log.info("notification worker started (concurrency: 5, rate: 100/min), waiting for jobs...");

// Graceful shutdown
const shutdown = async () => {
  log.info("shutting down notification worker...");
  await worker.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
