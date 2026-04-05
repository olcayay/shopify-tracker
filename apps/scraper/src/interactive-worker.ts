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
import { createLogger } from "@appranks/shared";
import { INTERACTIVE_QUEUE_NAME, getRedisConnection, type ScraperJobData } from "./queue.js";
import { initWorkerDeps, createProcessJob, runMigrations } from "./process-job.js";
import { cleanupStaleRuns } from "./jobs/cleanup-stale-runs.js";
import { serializeError } from "./utils/serialize-error.js";

const log = createLogger("interactive-worker");

const { db } = initWorkerDeps();
await runMigrations(db, "interactive-worker");

// Clean up orphaned scrape_runs from previous crashes
await cleanupStaleRuns(db);

const processJob = createProcessJob(db, "interactive");

const worker = new Worker<ScraperJobData>(
  INTERACTIVE_QUEUE_NAME,
  processJob,
  {
    connection: getRedisConnection(),
    concurrency: 1,
    // No rate limiter — interactive jobs should process as fast as possible
  }
);

worker.on("failed", (job, err) => {
  log.error("job failed", {
    jobId: job?.id,
    type: job?.data?.type,
    attempt: job?.attemptsMade,
    error: serializeError(err),
  });
});

worker.on("error", (err) => {
  log.error("worker error", { error: serializeError(err) });
});

log.info("interactive worker started, waiting for jobs...");

// Graceful shutdown
const shutdown = async () => {
  log.info("shutting down interactive worker...");
  await worker.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
