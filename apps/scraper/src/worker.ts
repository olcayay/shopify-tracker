import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
import { Worker } from "bullmq";
import { createLogger } from "@shopify-tracking/shared";
import { BACKGROUND_QUEUE_NAME, getRedisConnection, type ScraperJobData } from "./queue.js";
import { initWorkerDeps, createProcessJob, runMigrations } from "./process-job.js";

const log = createLogger("background-worker");

const { db, httpClient } = initWorkerDeps();
await runMigrations(db, "background-worker");
const processJob = createProcessJob(db, httpClient, "background");

const worker = new Worker<ScraperJobData>(
  BACKGROUND_QUEUE_NAME,
  processJob,
  {
    connection: getRedisConnection(),
    concurrency: 1, // Only 1 scraper job at a time to respect rate limits
    limiter: {
      max: 1,
      duration: 5000, // At most 1 job per 5 seconds
    },
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

log.info("background worker started, waiting for jobs...");

// Graceful shutdown
const shutdown = async () => {
  log.info("shutting down background worker...");
  await worker.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
