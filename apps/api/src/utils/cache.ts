import Redis from "ioredis";
import { REDIS_CONNECT_TIMEOUT_MS } from "../constants.js";

const CACHE_PREFIX = "cache:";

let redis: Redis | null = null;
let disabled = false;

function getRedis(): Redis | null {
  if (disabled) return null;
  if (redis) return redis;
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  try {
    redis = new Redis(url, {
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    redis.connect().catch(() => {
      redis = null;
    });
    return redis;
  } catch {
    return null;
  }
}

/** Reset Redis connection — for tests only. Pass null to disable Redis. */
export function _resetCacheRedis(mock?: Redis | null): void {
  if (mock === null || mock === undefined) {
    redis = null;
    disabled = mock === null;
  } else {
    redis = mock;
    disabled = false;
  }
}

/**
 * Cache-aside pattern: check Redis first, fallback to fetcher.
 * Fail-open: if Redis is unavailable, always runs the fetcher.
 */
export async function cacheGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  const client = getRedis();
  if (!client) return fetcher();

  const cacheKey = `${CACHE_PREFIX}${key}`;

  try {
    const cached = await client.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Redis read failed — fall through to fetcher
  }

  const result = await fetcher();

  try {
    await client.set(cacheKey, JSON.stringify(result), "EX", ttlSeconds);
  } catch {
    // Redis write failed — result still returned
  }

  return result;
}

/** Invalidate cache entries matching a pattern (e.g., "cache:features:*"). */
export async function cacheInvalidate(pattern: string): Promise<number> {
  const client = getRedis();
  if (!client) return 0;

  try {
    const keys = await client.keys(`${CACHE_PREFIX}${pattern}`);
    if (keys.length === 0) return 0;
    return await client.del(...keys);
  } catch {
    return 0;
  }
}

/** Delete a single cache key. */
export async function cacheDel(key: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.del(`${CACHE_PREFIX}${key}`);
  } catch {
    // Redis unavailable
  }
}
