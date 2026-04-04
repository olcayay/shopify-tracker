/**
 * Per-type notification rate limiting (PLA-698).
 *
 * Configurable limits per notification type per user.
 * E.g., max 5 ranking_change notifications per hour.
 */
import { createLogger } from "@appranks/shared";

const log = createLogger("notification:rate-limiter");

export interface RateLimitConfig {
  /** Max notifications of this type per time window */
  maxPerWindow: number;
  /** Time window in ms */
  windowMs: number;
}

/** Default rate limits per notification type */
const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  notification_ranking_change: { maxPerWindow: 10, windowMs: 60 * 60 * 1000 }, // 10/hour
  notification_new_competitor: { maxPerWindow: 5, windowMs: 60 * 60 * 1000 },  // 5/hour
  notification_new_review: { maxPerWindow: 20, windowMs: 60 * 60 * 1000 },     // 20/hour
  notification_milestone: { maxPerWindow: 5, windowMs: 60 * 60 * 1000 },       // 5/hour
  notification_price_change: { maxPerWindow: 5, windowMs: 60 * 60 * 1000 },    // 5/hour
  notification_category_change: { maxPerWindow: 10, windowMs: 60 * 60 * 1000 },// 10/hour
};

/** Global fallback limit */
const GLOBAL_LIMIT: RateLimitConfig = { maxPerWindow: 50, windowMs: 60 * 60 * 1000 }; // 50/hour total

/** In-memory sliding window counters: key = "userId:type", value = timestamps */
const counters = new Map<string, number[]>();

/**
 * Check if a notification is within rate limits.
 * Returns { allowed, remaining, resetAt }
 */
export function checkNotificationRateLimit(
  userId: string,
  notificationType: string
): { allowed: boolean; remaining: number; resetAt?: string; reason?: string } {
  const now = Date.now();
  const typeConfig = DEFAULT_LIMITS[notificationType] || GLOBAL_LIMIT;

  // Per-type check
  const typeKey = `${userId}:${notificationType}`;
  const typeResult = checkWindow(typeKey, typeConfig, now);
  if (!typeResult.allowed) {
    return { ...typeResult, reason: `per_type_limit (${notificationType})` };
  }

  // Global per-user check
  const globalKey = `${userId}:__global__`;
  const globalResult = checkWindow(globalKey, GLOBAL_LIMIT, now);
  if (!globalResult.allowed) {
    return { ...globalResult, reason: "global_user_limit" };
  }

  // Both passed — record the event
  recordEvent(typeKey, now);
  recordEvent(globalKey, now);

  return {
    allowed: true,
    remaining: Math.min(typeResult.remaining - 1, globalResult.remaining - 1),
  };
}

function checkWindow(
  key: string,
  config: RateLimitConfig,
  now: number
): { allowed: boolean; remaining: number; resetAt?: string } {
  const timestamps = counters.get(key) || [];

  // Remove expired entries
  const cutoff = now - config.windowMs;
  const active = timestamps.filter((t) => t > cutoff);
  counters.set(key, active);

  const remaining = config.maxPerWindow - active.length;

  if (remaining <= 0) {
    const oldestInWindow = active[0];
    const resetAt = new Date(oldestInWindow + config.windowMs).toISOString();
    return { allowed: false, remaining: 0, resetAt };
  }

  return { allowed: true, remaining };
}

function recordEvent(key: string, timestamp: number): void {
  const timestamps = counters.get(key) || [];
  timestamps.push(timestamp);
  counters.set(key, timestamps);
}

/**
 * Get current rate limit status for a user.
 */
export function getRateLimitStatus(userId: string): Record<string, {
  used: number;
  limit: number;
  remaining: number;
}> {
  const now = Date.now();
  const result: Record<string, { used: number; limit: number; remaining: number }> = {};

  for (const [type, config] of Object.entries(DEFAULT_LIMITS)) {
    const key = `${userId}:${type}`;
    const timestamps = counters.get(key) || [];
    const cutoff = now - config.windowMs;
    const active = timestamps.filter((t) => t > cutoff);
    result[type] = {
      used: active.length,
      limit: config.maxPerWindow,
      remaining: Math.max(0, config.maxPerWindow - active.length),
    };
  }

  // Global
  const globalKey = `${userId}:__global__`;
  const globalTs = counters.get(globalKey) || [];
  const globalCutoff = now - GLOBAL_LIMIT.windowMs;
  const globalActive = globalTs.filter((t) => t > globalCutoff);
  result.__global__ = {
    used: globalActive.length,
    limit: GLOBAL_LIMIT.maxPerWindow,
    remaining: Math.max(0, GLOBAL_LIMIT.maxPerWindow - globalActive.length),
  };

  return result;
}

/** Reset state (for testing) */
export function _resetRateLimiter(): void {
  counters.clear();
}
