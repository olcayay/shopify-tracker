interface PolicyCheckLogger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

interface PolicyClient {
  config: (subcommand: "GET", key: string) => Promise<unknown>;
}

/**
 * Verify Redis `maxmemory-policy` is `noeviction`.
 *
 * PLA-1053: BullMQ stores its monotonic job-ID counter (`bull:<queue>:id`) as a
 * plain Redis key. Any eviction-enabled policy (volatile-lru, allkeys-lru, …)
 * makes the counter evictable — when it's reclaimed, BullMQ restarts IDs from 1
 * and collides with every historical `scrape_runs.job_id`.
 *
 * We log loudly (error + Sentry) instead of failing fast: flipping `noeviction`
 * on the shared Redis is an infra change that has to land first. Once VM3 is
 * migrated, this check becomes a silent no-op.
 */
export async function assertRedisNoEviction(
  client: PolicyClient,
  log: PolicyCheckLogger,
  captureMessage?: (msg: string, level: "warning" | "error") => void,
): Promise<{ policy: string; ok: boolean }> {
  let raw: unknown;
  try {
    raw = await client.config("GET", "maxmemory-policy");
  } catch (err) {
    log.error("failed to read Redis maxmemory-policy", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { policy: "unknown", ok: false };
  }

  const policy = parsePolicy(raw);
  const ok = policy === "noeviction";

  if (ok) {
    log.info("redis maxmemory-policy is noeviction (OK)", { policy });
    return { policy, ok };
  }

  const banner =
    "Redis maxmemory-policy is NOT 'noeviction' — BullMQ job-id counters may be evicted and recycle, " +
    "causing scrape_runs.job_id collisions. Set 'maxmemory-policy noeviction' on Redis (VM3). See PLA-1053.";
  log.error(banner, { policy });
  captureMessage?.(`${banner} (current: ${policy})`, "error");
  return { policy, ok };
}

function parsePolicy(raw: unknown): string {
  if (Array.isArray(raw)) {
    // Redis CONFIG GET returns [key, value]
    return typeof raw[1] === "string" ? raw[1] : "unknown";
  }
  if (typeof raw === "string") return raw;
  return "unknown";
}
