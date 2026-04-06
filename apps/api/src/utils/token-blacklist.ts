import Redis from "ioredis";
import { REDIS_CONNECT_TIMEOUT_MS, REDIS_OPERATION_TIMEOUT_MS } from "../constants.js";

const BLACKLIST_PREFIX = "token:blacklist:";

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
    redis.on("error", () => {
      redis = null;
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
export function _resetBlacklistRedis(mock?: Redis | null): void {
  if (mock === null || mock === undefined) {
    redis = null;
    disabled = mock === null;
  } else {
    redis = mock;
    disabled = false;
  }
}

/**
 * Add a token's jti to the blacklist.
 * TTL is set to the remaining lifetime of the token (seconds).
 */
export async function blacklistToken(jti: string, expiresAt: number): Promise<void> {
  const client = getRedis();
  if (!client) return;

  const ttl = Math.max(expiresAt - Math.floor(Date.now() / 1000), 1);
  try {
    await client.set(`${BLACKLIST_PREFIX}${jti}`, "1", "EX", ttl);
  } catch {
    // Redis unavailable — token won't be blacklisted
  }
}

/** Race a promise against a timeout. Returns fallback on timeout. */
function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), REDIS_OPERATION_TIMEOUT_MS)),
  ]);
}

/**
 * Check if a token's jti is blacklisted.
 * Returns true if blacklisted, false otherwise.
 * If Redis is unavailable or slow, returns false (fail-open).
 */
export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;

  try {
    const result = await withTimeout(client.get(`${BLACKLIST_PREFIX}${jti}`), null);
    return result !== null;
  } catch {
    return false;
  }
}

/**
 * Blacklist all tokens for a user by storing a "revoked-before" timestamp.
 * Any token issued before this timestamp is considered invalid.
 * TTL matches the access token expiry (15 min = 900s).
 */
export async function revokeAllTokensForUser(userId: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    const now = Math.floor(Date.now() / 1000);
    // Store for 15 minutes (max access token lifetime)
    await client.set(`${BLACKLIST_PREFIX}user:${userId}`, now.toString(), "EX", 900);
  } catch {
    // Redis unavailable
  }
}

/**
 * Check if all tokens for a user have been revoked.
 * Returns true if the token was issued before the revocation timestamp.
 * If Redis is unavailable or slow, returns false (fail-open).
 */
export async function isUserTokenRevoked(userId: string, iat: number): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;

  try {
    const revokedBefore = await withTimeout(client.get(`${BLACKLIST_PREFIX}user:${userId}`), null);
    if (!revokedBefore) return false;
    return iat <= parseInt(revokedBefore, 10);
  } catch {
    return false;
  }
}
