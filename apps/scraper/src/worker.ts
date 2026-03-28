import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
import { Worker } from "bullmq";
import { createLogger } from "@appranks/shared";
import { BACKGROUND_QUEUE_NAME, INTERACTIVE_QUEUE_NAME, getRedisConnection, type ScraperJobData } from "./queue.js";
import { initWorkerDeps, createProcessJob, runMigrations } from "./process-job.js";
import { cleanupStaleRuns } from "./jobs/cleanup-stale-runs.js";
import { createGracefulShutdown } from "./graceful-shutdown.js";

const log = createLogger("worker");

/**
 * Per-platform mutex: ensures only one job per platform runs at a time,
 * while different platforms run in parallel.
 */
class PlatformLock {
  private locks = new Map<string, Promise<void>>();

  async acquire(platform: string): Promise<() => void> {
    while (this.locks.has(platform)) {
      await this.locks.get(platform)!;
    }
    let release!: () => void;
    this.locks.set(platform, new Promise<void>((r) => { release = r; }));
    return () => {
      this.locks.delete(platform);
      release();
    };
  }
}

const { db } = initWorkerDeps();
await runMigrations(db, "worker");

// Clean up orphaned scrape_runs from previous crashes
await cleanupStaleRuns(db);

const platformLock = new PlatformLock();

const bgProcessJobFn = createProcessJob(db, "background");
const intProcessJob = createProcessJob(db, "interactive");

const bgWorker = new Worker<ScraperJobData>(
  BACKGROUND_QUEUE_NAME,
  async (job) => {
    const platform = job.data.platform || "shopify";
    const release = await platformLock.acquire(platform);
    try {
      await bgProcessJobFn(job);
    } finally {
      release();
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

log.info("worker started, listening on background + interactive queues", { concurrency: 11 });

// ── Graceful shutdown ───────────────────────────────────────────────
const { shutdown } = createGracefulShutdown(
  [bgWorker, intWorker],
  log,
  { timeoutMs: 60_000 },
);

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
