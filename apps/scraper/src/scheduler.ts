import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
import cron from "node-cron";
import { createLogger } from "@appranks/shared";
import { enqueueScraperJob, closeQueue } from "./queue.js";

const log = createLogger("scheduler");

// Schedule definitions
const SCHEDULES = [
  // ── Shopify (default platform) ──
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
  {
    name: "compute_app_scores",
    cron: "0 9 * * *", // Daily at 09:00 UTC
    type: "compute_app_scores" as const,
  },
  // ── Salesforce ──
  {
    name: "salesforce_category",
    cron: "0 4 * * *", // Daily at 04:00
    type: "category" as const,
    platform: "salesforce" as const,
  },
  {
    name: "salesforce_app_details",
    cron: "0 2,14 * * *", // Every 12 hours (02:00, 14:00)
    type: "app_details" as const,
    platform: "salesforce" as const,
  },
  {
    name: "salesforce_reviews",
    cron: "0 7 * * *", // Daily at 07:00 UTC
    type: "reviews" as const,
    platform: "salesforce" as const,
  },
  {
    name: "salesforce_compute_app_scores",
    cron: "0 10 * * *", // Daily at 10:00 UTC
    type: "compute_app_scores" as const,
    platform: "salesforce" as const,
  },
  // ── Canva ──
  {
    name: "canva_category",
    cron: "30 4 * * *", // Daily at 04:30
    type: "category" as const,
    platform: "canva" as const,
  },
  {
    name: "canva_app_details",
    cron: "30 2,14 * * *", // Every 12 hours (02:30, 14:30)
    type: "app_details" as const,
    platform: "canva" as const,
  },
  {
    name: "canva_keyword_search",
    cron: "0 3,15 * * *", // Every 12 hours (03:00, 15:00)
    type: "keyword_search" as const,
    platform: "canva" as const,
  },
  {
    name: "canva_compute_app_scores",
    cron: "30 10 * * *", // Daily at 10:30 UTC
    type: "compute_app_scores" as const,
    platform: "canva" as const,
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
