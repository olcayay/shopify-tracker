import { describe, it, expect, beforeEach } from "vitest";
import {
  checkNotificationRateLimit,
  getRateLimitStatus,
  _resetRateLimiter,
} from "../../notifications/rate-limiter.js";

describe("Per-Type Notification Rate Limiting", () => {
  beforeEach(() => {
    _resetRateLimiter();
  });

  it("allows first notification", () => {
    const result = checkNotificationRateLimit("u1", "notification_ranking_change");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it("tracks per-type limits", () => {
    // Ranking change limit is 10/hour
    for (let i = 0; i < 10; i++) {
      const result = checkNotificationRateLimit("u1", "notification_ranking_change");
      expect(result.allowed).toBe(true);
    }

    // 11th should be blocked
    const blocked = checkNotificationRateLimit("u1", "notification_ranking_change");
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain("per_type_limit");
  });

  it("different types have independent limits", () => {
    // Use all ranking limit
    for (let i = 0; i < 10; i++) {
      checkNotificationRateLimit("u1", "notification_ranking_change");
    }

    // Review limit should still be available
    const result = checkNotificationRateLimit("u1", "notification_new_review");
    expect(result.allowed).toBe(true);
  });

  it("different users have independent limits", () => {
    for (let i = 0; i < 10; i++) {
      checkNotificationRateLimit("u1", "notification_ranking_change");
    }

    // u2 should still be allowed
    const result = checkNotificationRateLimit("u2", "notification_ranking_change");
    expect(result.allowed).toBe(true);
  });

  it("enforces global per-user limit (50/hour)", () => {
    // notification_new_review has per-type limit of 20, so we need to use
    // types with higher limits or mix them to reach 50 total
    // Use an unknown type that falls through to global limit
    for (let i = 0; i < 50; i++) {
      const result = checkNotificationRateLimit("u1", "notification_milestone");
      // notification_milestone has per-type limit of 5, so it will hit per-type first
    }

    // Simpler approach: just verify global tracking via status
    _resetRateLimiter();

    // Send across many different types to avoid per-type limits
    for (let i = 0; i < 5; i++) checkNotificationRateLimit("u1", "notification_ranking_change");
    for (let i = 0; i < 5; i++) checkNotificationRateLimit("u1", "notification_new_competitor");
    for (let i = 0; i < 5; i++) checkNotificationRateLimit("u1", "notification_milestone");
    for (let i = 0; i < 20; i++) checkNotificationRateLimit("u1", "notification_new_review");
    for (let i = 0; i < 5; i++) checkNotificationRateLimit("u1", "notification_price_change");
    for (let i = 0; i < 10; i++) checkNotificationRateLimit("u1", "notification_category_change");

    // That's 50 total — the next one should hit global
    const blocked = checkNotificationRateLimit("u1", "notification_ranking_change");
    // May hit global or per-type limit depending on order
    expect(blocked.allowed).toBe(false);
  });

  it("getRateLimitStatus returns per-type breakdown", () => {
    checkNotificationRateLimit("u1", "notification_ranking_change");
    checkNotificationRateLimit("u1", "notification_ranking_change");

    const status = getRateLimitStatus("u1");
    expect(status.notification_ranking_change.used).toBe(2);
    expect(status.notification_ranking_change.limit).toBe(10);
    expect(status.notification_ranking_change.remaining).toBe(8);
    expect(status.__global__.used).toBe(2);
  });

  it("provides resetAt when blocked", () => {
    for (let i = 0; i < 10; i++) {
      checkNotificationRateLimit("u1", "notification_ranking_change");
    }
    const blocked = checkNotificationRateLimit("u1", "notification_ranking_change");
    expect(blocked.resetAt).toBeDefined();
  });
});
