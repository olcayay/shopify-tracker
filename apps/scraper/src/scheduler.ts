import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
import cron from "node-cron";
import { createLogger, SCRAPER_SCHEDULES, isPlatformId } from "@appranks/shared";
import { createDb, platformVisibility } from "@appranks/db";
import { eq } from "drizzle-orm";
import { enqueueScraperJob, closeQueue, type ScraperJobType, type ScraperJobOptions } from "./queue.js";
import { isCircuitOpen } from "./circuit-breaker.js";
import { cleanupOldNotifications } from "./notifications/retention-cleanup.js";

const log = createLogger("scheduler");

// Lightweight DB connection for scraper visibility checks (read-only, uses replica if available)
const schedulerDbUrl = process.env.DATABASE_READ_URL || process.env.DATABASE_URL;
const schedulerDb = schedulerDbUrl ? createDb(schedulerDbUrl, { max: 1 }) : null;

/** PLA-1095: gate scheduler enqueue on platformVisibility.scraperEnabled only. */
async function isScraperEnabled(platform: string): Promise<boolean> {
  if (!schedulerDb || !isPlatformId(platform)) return true; // fail-open
  try {
    const [vis] = await schedulerDb.select({ scraperEnabled: platformVisibility.scraperEnabled }).from(platformVisibility).where(eq(platformVisibility.platform, platform)).limit(1);
    return !vis || vis.scraperEnabled !== false; // if row doesn't exist, allow
  } catch {
    return true; // fail-open on DB errors
  }
}

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

      // Check scraper is enabled for the platform before enqueuing
      const scraperOn = await isScraperEnabled(schedule.platform);
      if (!scraperOn) {
        log.warn("scraper disabled for platform, skipping job", { name: schedule.name, platform: schedule.platform });
        return;
      }
    }

    try {
      const jobId = await enqueueScraperJob({
        type: schedule.type as ScraperJobType,
        triggeredBy: "scheduler",
        ...("platform" in schedule ? { platform: schedule.platform } : {}),
        ...(schedule.options ? { options: schedule.options as ScraperJobOptions } : {}),
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

// ── Notification retention cleanup — daily at 03:00 UTC (PLA-688)
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  cron.schedule("0 3 * * *", async () => {
    log.info("notification retention cleanup starting");
    try {
      const db = createDb(databaseUrl, { max: 2 });
      const result = await cleanupOldNotifications(db);
      log.info("notification retention cleanup complete", {
        notificationsDeleted: result.notificationsDeleted,
        deliveryLogsDeleted: result.deliveryLogsDeleted,
        durationMs: result.durationMs,
      });
    } catch (err) {
      log.error("notification retention cleanup failed", { error: String(err) });
    }
  });
  log.info("notification retention cleanup scheduled (daily 03:00 UTC)");
} else {
  log.warn("DATABASE_URL not set, skipping notification retention cleanup");
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
