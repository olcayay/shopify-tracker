import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
import cron from "node-cron";
import { createLogger } from "@shopify-tracking/shared";
import { enqueueScraperJob, closeQueue } from "./queue.js";

const log = createLogger("scheduler");

// Schedule definitions
const SCHEDULES = [
  {
    name: "category",
    cron: "0 3 * * *", // Daily at 03:00
    type: "category" as const,
  },
  {
    name: "app_details",
    cron: "0 1,13 * * *", // Every 12 hours (01:00, 13:00)
    type: "app_details" as const,
  },
  {
    name: "keyword_search",
    cron: "0 0,12 * * *", // Every 12 hours (00:00, 12:00)
    type: "keyword_search" as const,
  },
  {
    name: "reviews",
    cron: "0 6 * * *", // Daily at 06:00 UTC
    type: "reviews" as const,
  },
  {
    name: "daily_digest",
    cron: "0 5 * * *", // Daily at 05:00 UTC (08:00 Istanbul)
    type: "daily_digest" as const,
  },
];

log.info("starting scheduler", {
  schedules: SCHEDULES.map((s) => ({ name: s.name, cron: s.cron })),
});

for (const schedule of SCHEDULES) {
  cron.schedule(schedule.cron, async () => {
    log.info("cron triggered", { name: schedule.name, type: schedule.type });
    try {
      const jobId = await enqueueScraperJob({
        type: schedule.type,
        triggeredBy: "scheduler",
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
