import { describe, it, expect } from "vitest";
import { RateLimiter } from "../../utils/rate-limiter.js";

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
});
