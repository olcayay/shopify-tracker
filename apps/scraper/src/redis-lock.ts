import { createLogger } from "@appranks/shared";
import Redis from "ioredis";

const log = createLogger("redis-lock");

/**
 * Redis-based distributed lock using SET NX PX pattern.
 * Ensures only one worker across all instances can hold a lock for a given key.
 * Uses Lua scripts for atomic release/extend to prevent accidental unlock by other processes.
 */
export class RedisLock {
  private ownerId: string;
  private redis: Redis;

  constructor(connection: { host?: string; port?: number; password?: string }) {
    this.ownerId = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    this.redis = new Redis({
      host: connection.host,
      port: connection.port,
      password: connection.password,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }

  /**
   * Try to acquire a lock. Returns true if the lock was acquired.
   * @param key   Lock key (e.g. "platform:shopify")
   * @param ttlMs Time-to-live in ms — auto-expires to prevent deadlocks (default 5 min)
   */
  async acquire(key: string, ttlMs: number = 300_000): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const result = await this.redis.set(lockKey, this.ownerId, "PX", ttlMs, "NX");
    return result === "OK";
  }

  /**
   * Release a lock — only if we still own it (atomic via Lua).
   */
  async release(key: string): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const lua = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
    const result = await this.redis.eval(lua, 1, lockKey, this.ownerId);
    return result === 1;
  }

  /**
   * Extend the TTL of a lock we own (atomic via Lua).
   */
  async extend(key: string, ttlMs: number = 300_000): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const lua = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end`;
    const result = await this.redis.eval(lua, 1, lockKey, this.ownerId, ttlMs.toString());
    return result === 1;
  }

  /**
   * Wait to acquire a lock, polling at intervals.
   * Returns a release function (similar to the old in-memory PlatformLock API).
   * @param key      Lock key
   * @param ttlMs    Lock TTL in ms (default 5 min)
   * @param retryMs  Polling interval in ms (default 500ms)
   * @param timeoutMs  Max wait time before giving up (default 5 min)
   */
  async acquireWithWait(
    key: string,
    ttlMs: number = 300_000,
    retryMs: number = 500,
    timeoutMs: number = 300_000,
  ): Promise<(() => Promise<void>) | null> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const acquired = await this.acquire(key, ttlMs);
      if (acquired) {
        return async () => {
          await this.release(key);
        };
      }
      await new Promise((r) => setTimeout(r, retryMs));
    }

    log.warn("lock acquisition timed out", { key, timeoutMs });
    return null;
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
