import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
import cron from "node-cron";
import { createLogger, SCRAPER_SCHEDULES } from "@appranks/shared";
import { enqueueScraperJob, closeQueue, type ScraperJobType } from "./queue.js";
import { isCircuitOpen } from "./circuit-breaker.js";

const log = createLogger("scheduler");

log.info("starting scheduler", {
  schedules: SCRAPER_SCHEDULES.map((s) => ({ name: s.name, cron: s.cron })),
});

/** Random jitter (0-120s) to stagger job starts and avoid thundering herd. Disabled in tests. */
const JITTER_MAX_MS = process.env.SMOKE_TEST === "1" || process.env.NODE_ENV === "test" ? 0 : 120_000;

for (const schedule of SCRAPER_SCHEDULES) {
  cron.schedule(schedule.cron, async () => {
    const delay = JITTER_MAX_MS > 0 ? Math.floor(Math.random() * JITTER_MAX_MS) : 0;
    if (delay > 0) {
      log.info("cron triggered, applying jitter", { name: schedule.name, delayMs: delay });
      await new Promise((r) => setTimeout(r, delay));
    } else {
      log.info("cron triggered", { name: schedule.name, type: schedule.type });
    }

    // Check circuit breaker before enqueuing
    if ("platform" in schedule) {
      const open = await isCircuitOpen(schedule.platform);
      if (open) {
        log.warn("circuit open, skipping job", { name: schedule.name, platform: schedule.platform });
        return;
      }
    }

    try {
      const jobId = await enqueueScraperJob({
        type: schedule.type as ScraperJobType,
        triggeredBy: "scheduler",
        ...("platform" in schedule ? { platform: schedule.platform } : {}),
      });
      log.info("job enqueued", { name: schedule.name, jobId });
    } catch (err) {
      log.error("failed to enqueue job", {
        name: schedule.name,
        error: String(err),
      });
    }
  });
}

log.info("scheduler running. Press Ctrl+C to stop.");

// Graceful shutdown
const shutdown = async () => {
  log.info("shutting down scheduler...");
  await closeQueue();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
