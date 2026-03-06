import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
import { Worker } from "bullmq";
import { createLogger } from "@appranks/shared";
import { BACKGROUND_QUEUE_NAME, INTERACTIVE_QUEUE_NAME, getRedisConnection, type ScraperJobData } from "./queue.js";
import { initWorkerDeps, createProcessJob, runMigrations } from "./process-job.js";

const log = createLogger("worker");

const { db, httpClient } = initWorkerDeps();
await runMigrations(db, "worker");

const bgProcessJob = createProcessJob(db, httpClient, "background");
const intProcessJob = createProcessJob(db, httpClient, "interactive");

const bgWorker = new Worker<ScraperJobData>(
  BACKGROUND_QUEUE_NAME,
  bgProcessJob,
  {
    connection: getRedisConnection(),
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 5000,
    },
  }
);

const intWorker = new Worker<ScraperJobData>(
  INTERACTIVE_QUEUE_NAME,
  intProcessJob,
  {
    connection: getRedisConnection(),
    concurrency: 1,
  }
);

for (const [name, w] of [["background", bgWorker], ["interactive", intWorker]] as const) {
  w.on("failed", (job, err) => {
    log.error(`[${name}] job failed`, {
      jobId: job?.id,
      type: job?.data?.type,
      attempt: job?.attemptsMade,
      error: String(err),
    });
  });

  w.on("error", (err) => {
    log.error(`[${name}] worker error`, { error: String(err) });
  });
}

log.info("worker started, listening on background + interactive queues");

// Graceful shutdown
const shutdown = async () => {
  log.info("shutting down workers...");
  await Promise.all([bgWorker.close(), intWorker.close()]);
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
