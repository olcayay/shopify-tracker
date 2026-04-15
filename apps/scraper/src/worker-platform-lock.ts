import type { Job } from "bullmq";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { platformVisibility } from "@appranks/db";
import { isPlatformId } from "@appranks/shared";
import type { ScraperJobData } from "./queue.js";
import type { RedisLock } from "./redis-lock.js";

interface LockLogger {
  warn: (msg: string, meta?: Record<string, unknown>) => void;
}

export const NON_PLATFORM_JOBS = new Set<string>([
  "daily_digest",
  "weekly_summary",
  "data_cleanup",
]);

export interface PlatformLockDeps {
  db: NodePgDatabase<Record<string, never>> | { select: (...args: unknown[]) => unknown };
  redisLock: Pick<RedisLock, "acquireWithWait" | "extend">;
  log: LockLogger;
  lockTtlMs: number;
  lockPollMs: number;
  lockTimeoutMs: number;
  /** How often (ms) to extend the lock while the job runs. Should be < lockTtlMs. */
  lockRenewMs: number;
}

/**
 * Wrap a BullMQ processor with per-platform Redis lock + feature-flag gate.
 *
 * PLA-1060: both background AND interactive workers must hold the lock —
 * two interactive worker instances were previously able to scrape the same
 * platform concurrently, producing duplicate `scrape_runs` rows and
 * double-writes to `app_snapshots`.
 */
export function withPlatformLock(
  processFn: (job: Job<ScraperJobData>) => Promise<void> | Promise<unknown>,
  deps: PlatformLockDeps,
): (job: Job<ScraperJobData>) => Promise<void> {
  const { db, redisLock, log, lockTtlMs, lockPollMs, lockTimeoutMs, lockRenewMs } = deps;
  return async (job: Job<ScraperJobData>): Promise<void> => {
    if (NON_PLATFORM_JOBS.has(job.data.type)) {
      await processFn(job);
      return;
    }

    const platform = job.data.platform || "shopify";

    // PLA-1095: gate scraper execution on platformVisibility.scraperEnabled only.
    if (isPlatformId(platform)) {
      try {
        const rows = await (db as {
          select: (x: unknown) => {
            from: (t: unknown) => {
              where: (p: unknown) => { limit: (n: number) => Promise<Array<{ scraperEnabled: boolean }>> };
            };
          };
        })
          .select({ scraperEnabled: platformVisibility.scraperEnabled })
          .from(platformVisibility)
          .where(eq(platformVisibility.platform, platform))
          .limit(1);
        const vis = rows[0];
        if (vis && vis.scraperEnabled === false) {
          log.warn("scraper disabled for platform, skipping job", {
            jobId: job.id,
            platform,
            type: job.data.type,
          });
          return;
        }
      } catch {
        // Fail-open: continue processing if visibility check fails
      }
    }

    const lockKey = `platform:${platform}:${job.data.type}`;
    const release = await redisLock.acquireWithWait(
      lockKey,
      lockTtlMs,
      lockPollMs,
      lockTimeoutMs,
    );
    if (!release) {
      throw new Error(
        `Could not acquire lock for platform ${platform} within ${lockTimeoutMs}ms`,
      );
    }
    const renewTimer = setInterval(() => {
      redisLock.extend(lockKey, lockTtlMs).catch((err) => {
        log.warn("platform lock extend failed", { lockKey, error: String(err) });
      });
    }, lockRenewMs);
    try {
      await processFn(job);
    } finally {
      clearInterval(renewTimer);
      await release();
    }
  };
}
