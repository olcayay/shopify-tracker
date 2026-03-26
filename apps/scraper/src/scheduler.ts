import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
import cron from "node-cron";
import { createLogger, SCRAPER_SCHEDULES } from "@appranks/shared";
import { enqueueScraperJob, closeQueue, type ScraperJobType } from "./queue.js";

const log = createLogger("scheduler");

log.info("starting scheduler", {
  schedules: SCRAPER_SCHEDULES.map((s) => ({ name: s.name, cron: s.cron })),
});

for (const schedule of SCRAPER_SCHEDULES) {
  cron.schedule(schedule.cron, async () => {
    log.info("cron triggered", { name: schedule.name, type: schedule.type });
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
