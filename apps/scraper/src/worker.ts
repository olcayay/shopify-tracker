import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
import { Worker, type Job } from "bullmq";
import { createLogger } from "@appranks/shared";
import { deadLetterJobs } from "@appranks/db";
import { BACKGROUND_QUEUE_NAME, INTERACTIVE_QUEUE_NAME, getRedisConnection, type ScraperJobData } from "./queue.js";
import { initWorkerDeps, createProcessJob, runMigrations } from "./process-job.js";
import { cleanupStaleRuns } from "./jobs/cleanup-stale-runs.js";
import { createGracefulShutdown } from "./graceful-shutdown.js";
import { RedisLock } from "./redis-lock.js";

const log = createLogger("worker");

const { db } = initWorkerDeps();
await runMigrations(db, "worker");

// Clean up orphaned scrape_runs from previous crashes
await cleanupStaleRuns(db);

/**
 * Distributed per-platform lock via Redis SET NX.
 * Ensures only one job per platform runs at a time across all worker instances.
 * 5-minute TTL auto-expires to prevent deadlocks if a worker crashes.
 */
const LOCK_TTL_MS = 300_000; // 5 minutes
const LOCK_TIMEOUT_MS = 300_000; // 5 minutes max wait
const redisLock = new RedisLock(getRedisConnection() as { host?: string; port?: number; password?: string });

const bgProcessJobFn = createProcessJob(db, "background");
const intProcessJob = createProcessJob(db, "interactive");

const bgWorker = new Worker<ScraperJobData>(
  BACKGROUND_QUEUE_NAME,
  async (job) => {
    const platform = job.data.platform || "shopify";
    const lockKey = `platform:${platform}`;
    const release = await redisLock.acquireWithWait(lockKey, LOCK_TTL_MS, 500, LOCK_TIMEOUT_MS);
    if (!release) {
      throw new Error(`Could not acquire lock for platform ${platform} within ${LOCK_TIMEOUT_MS}ms`);
    }
    try {
      await bgProcessJobFn(job);
    } finally {
      await release();
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 11,
    // No rate limiter — per-platform lock handles serialization
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

/**
 * Insert a permanently failed job into the dead_letter_jobs table.
 * Errors are caught internally so DLQ failures never crash the worker.
 */
async function insertDeadLetterJob(
  queueName: string,
  job: Job<ScraperJobData>,
  err: Error,
): Promise<void> {
  try {
    await db.insert(deadLetterJobs).values({
      jobId: job.id ?? "unknown",
      queueName,
      jobType: job.data?.type ?? "unknown",
      platform: job.data?.platform ?? null,
      payload: job.data as unknown as Record<string, unknown>,
      errorMessage: err.message ?? String(err),
      errorStack: err.stack ?? null,
      attemptsMade: job.attemptsMade,
    });
    log.info("dead letter job recorded", { jobId: job.id, type: job.data?.type });
  } catch (dlqErr) {
    log.error("failed to insert dead letter job", {
      jobId: job.id,
      error: String(dlqErr),
    });
  }
}

for (const [name, w] of [["background", bgWorker], ["interactive", intWorker]] as const) {
  w.on("failed", (job, err) => {
    log.error(`[${name}] job failed`, {
      jobId: job?.id,
      type: job?.data?.type,
      attempt: job?.attemptsMade,
      error: String(err),
    });

    // If all retries are exhausted, record in dead letter queue
    if (job && job.attemptsMade >= (job.opts?.attempts ?? 1)) {
      insertDeadLetterJob(name, job, err);
    }
  });

  w.on("error", (err) => {
    log.error(`[${name}] worker error`, { error: String(err) });
  });
}

log.info("worker started, listening on background + interactive queues", { concurrency: 11 });

// ── Graceful shutdown ───────────────────────────────────────────────
const { shutdown } = createGracefulShutdown(
  [bgWorker, intWorker],
  log,
  { timeoutMs: 60_000 },
);

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
