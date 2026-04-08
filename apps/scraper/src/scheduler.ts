import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
import cron from "node-cron";
import { createLogger, SCRAPER_SCHEDULES, platformFeatureFlagSlug, isPlatformId, type PlatformId } from "@appranks/shared";
import { createDb, featureFlags } from "@appranks/db";
import { eq } from "drizzle-orm";
import { enqueueScraperJob, closeQueue, type ScraperJobType } from "./queue.js";
import { isCircuitOpen } from "./circuit-breaker.js";
import { cleanupOldNotifications } from "./notifications/retention-cleanup.js";

const log = createLogger("scheduler");

// Lightweight DB connection for feature flag checks (1 connection)
const schedulerDb = process.env.DATABASE_URL ? createDb(process.env.DATABASE_URL, { max: 1 }) : null;

/** Check if a platform's feature flag is globally enabled */
async function isPlatformFlagEnabled(platform: string): Promise<boolean> {
  if (!schedulerDb || !isPlatformId(platform)) return true; // fail-open
  try {
    const flagSlug = platformFeatureFlagSlug(platform as PlatformId);
    const [flag] = await schedulerDb.select({ isEnabled: featureFlags.isEnabled }).from(featureFlags).where(eq(featureFlags.slug, flagSlug)).limit(1);
    return !flag || flag.isEnabled; // if flag doesn't exist, allow
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

      // Check platform feature flag before enqueuing
      const flagEnabled = await isPlatformFlagEnabled(schedule.platform);
      if (!flagEnabled) {
        log.warn("platform feature flag disabled, skipping job", { name: schedule.name, platform: schedule.platform });
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
