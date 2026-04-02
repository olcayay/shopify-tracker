import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter, _resetRateLimitRedis } from "../../utils/rate-limiter.js";

// Disable Redis for unit tests — tests use in-memory fallback
beforeEach(() => {
  _resetRateLimitRedis(null);
});

describe("RateLimiter", () => {
  it("allows requests within limit", () => {
    const limiter = new RateLimiter({ maxAttempts: 3, windowMs: 60_000 });
    expect(limiter.check("ip1").allowed).toBe(true);
    expect(limiter.check("ip1").allowed).toBe(true);
    expect(limiter.check("ip1").allowed).toBe(true);
  });

  it("blocks requests exceeding limit", () => {
    const limiter = new RateLimiter({ maxAttempts: 2, windowMs: 60_000 });
    expect(limiter.check("ip1").allowed).toBe(true);
    expect(limiter.check("ip1").allowed).toBe(true);
    const result = limiter.check("ip1");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
    }
  });

  it("tracks different keys independently", () => {
    const limiter = new RateLimiter({ maxAttempts: 1, windowMs: 60_000 });
    expect(limiter.check("ip1").allowed).toBe(true);
    expect(limiter.check("ip1").allowed).toBe(false);
    expect(limiter.check("ip2").allowed).toBe(true);
  });

  it("resets after window expires", () => {
    const limiter = new RateLimiter({ maxAttempts: 1, windowMs: 10 }); // 10ms window
    expect(limiter.check("ip1").allowed).toBe(true);
    expect(limiter.check("ip1").allowed).toBe(false);

    // Wait for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(limiter.check("ip1").allowed).toBe(true);
        resolve();
      }, 20);
    });
  });

  it("reset() clears all entries", () => {
    const limiter = new RateLimiter({ maxAttempts: 1, windowMs: 60_000 });
    expect(limiter.check("ip1").allowed).toBe(true);
    expect(limiter.check("ip1").allowed).toBe(false);
    limiter.reset();
    expect(limiter.check("ip1").allowed).toBe(true);
  });

  it("continues blocking after limit until window expires", () => {
    const limiter = new RateLimiter({ maxAttempts: 1, windowMs: 60_000 });
    expect(limiter.check("key").allowed).toBe(true);
    // Multiple blocked attempts should all return allowed: false
    expect(limiter.check("key").allowed).toBe(false);
    expect(limiter.check("key").allowed).toBe(false);
    expect(limiter.check("key").allowed).toBe(false);
  });

  it("retryAfterMs decreases over time", () => {
    const limiter = new RateLimiter({ maxAttempts: 1, windowMs: 60_000 });
    limiter.check("key"); // use the single attempt

    const first = limiter.check("key");
    expect(first.allowed).toBe(false);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const second = limiter.check("key");
        expect(second.allowed).toBe(false);
        if (!first.allowed && !second.allowed) {
          expect(second.retryAfterMs).toBeLessThan(first.retryAfterMs);
        }
        resolve();
      }, 50);
    });
  });

  it("allows exactly maxAttempts requests then blocks", () => {
    const limiter = new RateLimiter({ maxAttempts: 5, windowMs: 60_000 });
    for (let i = 0; i < 5; i++) {
      expect(limiter.check("user1").allowed).toBe(true);
    }
    expect(limiter.check("user1").allowed).toBe(false);
  });

  it("works with different rate limit configurations simultaneously", () => {
    // Simulates the three-tier global rate limiting setup
    const authLimiter = new RateLimiter({ maxAttempts: 200, windowMs: 60_000 });
    const publicLimiter = new RateLimiter({ maxAttempts: 30, windowMs: 60_000 });
    const adminLimiter = new RateLimiter({ maxAttempts: 20, windowMs: 60_000 });

    // Each limiter is independent
    for (let i = 0; i < 20; i++) {
      expect(adminLimiter.check("admin1").allowed).toBe(true);
    }
    expect(adminLimiter.check("admin1").allowed).toBe(false);

    // Public limiter still has capacity for same key
    for (let i = 0; i < 30; i++) {
      expect(publicLimiter.check("admin1").allowed).toBe(true);
    }
    expect(publicLimiter.check("admin1").allowed).toBe(false);

    // Auth limiter still has capacity
    expect(authLimiter.check("admin1").allowed).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Additional edge-case tests
  // -----------------------------------------------------------------------

  it("maxAttempts=1 blocks on the second request", () => {
    const limiter = new RateLimiter({ maxAttempts: 1, windowMs: 60_000 });
    expect(limiter.check("k").allowed).toBe(true);
    const result = limiter.check("k");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("handles many different keys without interference", () => {
    const limiter = new RateLimiter({ maxAttempts: 1, windowMs: 60_000 });
    // 100 unique keys should all be allowed once
    for (let i = 0; i < 100; i++) {
      expect(limiter.check(`ip-${i}`).allowed).toBe(true);
    }
    // But second request from any of them should be blocked
    expect(limiter.check("ip-0").allowed).toBe(false);
    expect(limiter.check("ip-50").allowed).toBe(false);
    expect(limiter.check("ip-99").allowed).toBe(false);
  });

  it("reset() only clears the specific limiter instance", () => {
    const limiterA = new RateLimiter({ maxAttempts: 1, windowMs: 60_000 });
    const limiterB = new RateLimiter({ maxAttempts: 1, windowMs: 60_000 });

    limiterA.check("key1"); // use up the attempt
    limiterB.check("key1"); // use up the attempt

    limiterA.reset();
    expect(limiterA.check("key1").allowed).toBe(true); // reset cleared it
    expect(limiterB.check("key1").allowed).toBe(false); // still blocked
  });

  it("per-user key (userId) and per-IP key are independent", () => {
    const limiter = new RateLimiter({ maxAttempts: 2, windowMs: 60_000 });

    // Per-IP key
    expect(limiter.check("ip:192.168.1.1").allowed).toBe(true);
    expect(limiter.check("ip:192.168.1.1").allowed).toBe(true);
    expect(limiter.check("ip:192.168.1.1").allowed).toBe(false);

    // Per-user key from the same conceptual user — independent in the limiter
    expect(limiter.check("user:user-001").allowed).toBe(true);
    expect(limiter.check("user:user-001").allowed).toBe(true);
    expect(limiter.check("user:user-001").allowed).toBe(false);
  });

  it("namespace separates limiters in shared store", () => {
    const limiterA = new RateLimiter({ maxAttempts: 1, windowMs: 60_000, namespace: "ns_a" });
    const limiterB = new RateLimiter({ maxAttempts: 1, windowMs: 60_000, namespace: "ns_b" });

    expect(limiterA.check("key1").allowed).toBe(true);
    expect(limiterA.check("key1").allowed).toBe(false);

    // limiterB should be independent
    expect(limiterB.check("key1").allowed).toBe(true);
    expect(limiterB.check("key1").allowed).toBe(false);
  });

  it("checkAsync falls back to in-memory when Redis is disabled", async () => {
    _resetRateLimitRedis(null); // disable Redis
    const limiter = new RateLimiter({ maxAttempts: 2, windowMs: 60_000, namespace: "async_test" });
    expect((await limiter.checkAsync("ip1")).allowed).toBe(true);
    expect((await limiter.checkAsync("ip1")).allowed).toBe(true);
    expect((await limiter.checkAsync("ip1")).allowed).toBe(false);
  });

  it("window reset allows new burst of requests", () => {
    const limiter = new RateLimiter({ maxAttempts: 3, windowMs: 10 }); // 10ms window
    // Exhaust the limit
    for (let i = 0; i < 3; i++) limiter.check("burst");
    expect(limiter.check("burst").allowed).toBe(false);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // After window expires, full burst should be available again
        for (let i = 0; i < 3; i++) {
          expect(limiter.check("burst").allowed).toBe(true);
        }
        expect(limiter.check("burst").allowed).toBe(false);
        resolve();
      }, 20);
    });
  });
});
