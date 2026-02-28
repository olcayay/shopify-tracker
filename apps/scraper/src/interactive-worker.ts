import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
import { Worker } from "bullmq";
import { createLogger } from "@shopify-tracking/shared";
import { INTERACTIVE_QUEUE_NAME, getRedisConnection, type ScraperJobData } from "./queue.js";
import { initWorkerDeps, createProcessJob, runMigrations } from "./process-job.js";

const log = createLogger("interactive-worker");

const { db, httpClient } = initWorkerDeps();
await runMigrations(db, "interactive-worker");
const processJob = createProcessJob(db, httpClient, "interactive");

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
    error: String(err),
  });
});

worker.on("error", (err) => {
  log.error("worker error", { error: String(err) });
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
