import { describe, it, expect, beforeEach } from "vitest";
import { AdaptiveRateLimiter } from "../rate-limiter.js";

describe("AdaptiveRateLimiter", () => {
  let limiter: AdaptiveRateLimiter;

  beforeEach(() => {
    limiter = new AdaptiveRateLimiter({
      maxPerMinute: 50,
      minPerMinute: 5,
      throttleReductionFactor: 0.5,
      recoveryIncrement: 5,
    });
  });

  it("starts at max rate", () => {
    expect(limiter.currentRate).toBe(50);
    expect(limiter.isThrottled).toBe(false);
  });

  it("reduces rate on throttle", () => {
    limiter.recordThrottle();
    expect(limiter.currentRate).toBe(25); // 50 * 0.5
    expect(limiter.isThrottled).toBe(true);
  });

  it("does not go below minimum rate", () => {
    limiter.recordThrottle(); // 25
    limiter.recordThrottle(); // 12
    limiter.recordThrottle(); // 6
    limiter.recordThrottle(); // 5 (min)
    expect(limiter.currentRate).toBe(5);
    limiter.recordThrottle();
    expect(limiter.currentRate).toBe(5); // stays at min
  });

  it("recovers rate after 10 consecutive successes", () => {
    limiter.recordThrottle(); // 25
    expect(limiter.currentRate).toBe(25);

    for (let i = 0; i < 10; i++) {
      limiter.recordSuccess();
    }
    expect(limiter.currentRate).toBe(30); // 25 + 5
  });

  it("does not recover above max rate", () => {
    // Already at max
    for (let i = 0; i < 20; i++) {
      limiter.recordSuccess();
    }
    expect(limiter.currentRate).toBe(50);
  });

  it("resets consecutive successes on throttle", () => {
    for (let i = 0; i < 5; i++) limiter.recordSuccess();
    limiter.recordThrottle(); // 25, resets counter

    // Need full 10 successes from scratch
    for (let i = 0; i < 9; i++) limiter.recordSuccess();
    expect(limiter.currentRate).toBe(25); // not yet recovered

    limiter.recordSuccess(); // 10th success
    expect(limiter.currentRate).toBe(30); // recovered
  });

  it("tracks last throttle time", () => {
    expect(limiter.timeSinceThrottle).toBeNull();
    limiter.recordThrottle();
    expect(limiter.timeSinceThrottle).not.toBeNull();
    expect(limiter.timeSinceThrottle!).toBeGreaterThanOrEqual(0);
  });

  it("isRateLimitError detects rate limit messages", () => {
    expect(limiter.isRateLimitError(new Error("Rate limit exceeded"))).toBe(true);
    expect(limiter.isRateLimitError(new Error("429 Too Many Requests"))).toBe(true);
    expect(limiter.isRateLimitError(new Error("throttled by provider"))).toBe(true);
    expect(limiter.isRateLimitError(new Error("too many connections"))).toBe(true);
    expect(limiter.isRateLimitError(new Error("normal error"))).toBe(false);
  });

  it("getBullMQConfig returns correct format", () => {
    const config = limiter.getBullMQConfig();
    expect(config.max).toBe(50);
    expect(config.duration).toBe(60_000);

    limiter.recordThrottle();
    const throttledConfig = limiter.getBullMQConfig();
    expect(throttledConfig.max).toBe(25);
  });

  it("reset restores max rate", () => {
    limiter.recordThrottle();
    limiter.recordThrottle();
    expect(limiter.currentRate).toBeLessThan(50);

    limiter.reset();
    expect(limiter.currentRate).toBe(50);
    expect(limiter.isThrottled).toBe(false);
    expect(limiter.timeSinceThrottle).toBeNull();
  });

  it("getSnapshot returns complete state", () => {
    limiter.recordThrottle();
    const snap = limiter.getSnapshot();

    expect(snap.currentRate).toBe(25);
    expect(snap.maxRate).toBe(50);
    expect(snap.minRate).toBe(5);
    expect(snap.isThrottled).toBe(true);
    expect(snap.consecutiveSuccesses).toBe(0);
    expect(snap.lastThrottleAt).not.toBeNull();
  });
});
