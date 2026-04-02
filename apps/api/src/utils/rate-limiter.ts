import Redis from "ioredis";
import { RATE_LIMIT_CLEANUP_INTERVAL_MS, REDIS_CONNECT_TIMEOUT_MS } from "../constants.js";

// ---------------------------------------------------------------------------
// In-memory fallback (used when Redis is unavailable)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class InMemoryStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), RATE_LIMIT_CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  check(key: string, maxAttempts: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now >= entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: maxAttempts - 1, resetAt: now + windowMs, limit: maxAttempts };
    }

    if (entry.count >= maxAttempts) {
      return { allowed: false, retryAfterMs: entry.resetAt - now, remaining: 0, resetAt: entry.resetAt, limit: maxAttempts };
    }

    entry.count++;
    return { allowed: true, remaining: maxAttempts - entry.count, resetAt: entry.resetAt, limit: maxAttempts };
  }

  clear(prefix?: string) {
    if (!prefix) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.resetAt) this.store.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Redis connection management
// ---------------------------------------------------------------------------

const RL_PREFIX = "rl:";

let _redis: Redis | null = null;
let _redisDisabled = false;

function getRedis(): Redis | null {
  if (_redisDisabled) return null;
  if (_redis) return _redis;
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  try {
    _redis = new Redis(url, {
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    _redis.connect().catch(() => {
      _redis = null;
    });
    return _redis;
  } catch {
    return null;
  }
}

/** Reset Redis connection — for tests only. Pass null to disable Redis. */
export function _resetRateLimitRedis(mock?: Redis | null): void {
  if (mock === null || mock === undefined) {
    _redis = null;
    _redisDisabled = mock === null;
  } else {
    _redis = mock;
    _redisDisabled = false;
  }
}

// ---------------------------------------------------------------------------
// RateLimiter (Redis-backed with in-memory fallback)
// ---------------------------------------------------------------------------

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: number; limit: number }
  | { allowed: false; retryAfterMs: number; remaining: number; resetAt: number; limit: number };

const fallbackStore = new InMemoryStore();

/**
 * Rate limiter that uses Redis when available, falling back to in-memory.
 * Uses a fixed-window counter with TTL in Redis.
 *
 * Key format: rl:{namespace}:{key}:{windowId}
 */
let _instanceCounter = 0;

export class RateLimiter {
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly namespace: string;

  constructor(opts: { maxAttempts: number; windowMs: number; namespace?: string }) {
    this.maxAttempts = opts.maxAttempts;
    this.windowMs = opts.windowMs;
    this.namespace = opts.namespace || `rl_${++_instanceCounter}`;
  }

  /**
   * Check if the key is rate limited.
   * Uses Redis if available, falls back to in-memory.
   */
  check(key: string): RateLimitResult {
    const redis = getRedis();

    // Always check in-memory for immediate response
    const memResult = fallbackStore.check(
      `${this.namespace}:${key}`,
      this.maxAttempts,
      this.windowMs,
    );

    // Fire-and-forget Redis sync for cross-server awareness
    if (redis) {
      const windowId = Math.floor(Date.now() / this.windowMs);
      const redisKey = `${RL_PREFIX}${this.namespace}:${key}:${windowId}`;
      const ttlSeconds = Math.ceil(this.windowMs / 1000) + 1;

      redis.incr(redisKey).then((count) => {
        if (count === 1) {
          redis.expire(redisKey, ttlSeconds).catch(() => {});
        }
      }).catch(() => {});
    }

    return memResult;
  }

  /**
   * Async check that reads from Redis first for accurate cross-server counts.
   * Falls back to in-memory if Redis is unavailable.
   */
  async checkAsync(key: string): Promise<RateLimitResult> {
    const redis = getRedis();
    if (!redis) {
      return fallbackStore.check(
        `${this.namespace}:${key}`,
        this.maxAttempts,
        this.windowMs,
      );
    }

    try {
      const windowId = Math.floor(Date.now() / this.windowMs);
      const redisKey = `${RL_PREFIX}${this.namespace}:${key}:${windowId}`;
      const ttlSeconds = Math.ceil(this.windowMs / 1000) + 1;

      const count = await redis.incr(redisKey);
      if (count === 1) {
        await redis.expire(redisKey, ttlSeconds);
      }

      const resetAtMs = Date.now() + ttlSeconds * 1000;
      if (count > this.maxAttempts) {
        const ttl = await redis.ttl(redisKey);
        return { allowed: false, retryAfterMs: Math.max(ttl * 1000, 1000), remaining: 0, resetAt: resetAtMs, limit: this.maxAttempts };
      }

      return { allowed: true, remaining: this.maxAttempts - count, resetAt: resetAtMs, limit: this.maxAttempts };
    } catch {
      // Redis failed — fall back to in-memory
      return fallbackStore.check(
        `${this.namespace}:${key}`,
        this.maxAttempts,
        this.windowMs,
      );
    }
  }

  /** Clear entries for this limiter's namespace. Useful for tests. */
  reset() {
    fallbackStore.clear(`${this.namespace}:`);
  }
}
