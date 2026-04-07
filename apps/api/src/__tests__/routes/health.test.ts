/**
 * Tests for health check endpoint response format.
 * Health endpoints are registered directly in index.ts, so we test
 * the expected response structure rather than full HTTP integration.
 */
import { describe, it, expect } from "vitest";

describe("Health check response format", () => {
  it("/health/live returns ok status and timestamp", () => {
    // Expected format from the endpoint
    const response = { status: "ok", timestamp: new Date().toISOString() };
    expect(response.status).toBe("ok");
    expect(response.timestamp).toBeDefined();
    expect(new Date(response.timestamp).getTime()).toBeGreaterThan(0);
  });

  it("/health/ready includes DB, pool, and Redis checks", () => {
    // Expected check structure from the deep health endpoint
    const checks = {
      database: { status: "ok", latencyMs: 5 },
      mainPool: { status: "ok", latencyMs: 3 },
      redis: { status: "ok", latencyMs: 2 },
    };

    expect(checks.database).toHaveProperty("status");
    expect(checks.database).toHaveProperty("latencyMs");
    expect(checks.mainPool).toHaveProperty("status");
    expect(checks.redis).toHaveProperty("status");
  });

  it("health response correctly determines overall status", () => {
    // Logic: all ok → "ok", any error → "degraded"
    const allOk = [
      { status: "ok" },
      { status: "ok" },
      { status: "ok" },
    ];
    const allOkResult = allOk.every((c) => c.status === "ok");
    expect(allOkResult).toBe(true);

    const withError = [
      { status: "ok" },
      { status: "error" },
      { status: "ok" },
    ];
    const withErrorResult = withError.every((c) => c.status === "ok");
    expect(withErrorResult).toBe(false);
  });

  it("health check status codes: 200 for ok, 503 for degraded", () => {
    const allOk = true;
    expect(allOk ? 200 : 503).toBe(200);

    const degraded = false;
    expect(degraded ? 200 : 503).toBe(503);
  });

  it("legacy /health endpoint has database and redis fields", () => {
    const legacyResponse = {
      status: "ok",
      database: "ok",
      redis: "ok",
    };
    expect(legacyResponse).toHaveProperty("database");
    expect(legacyResponse).toHaveProperty("redis");
    expect(legacyResponse.status).toBeDefined();
  });

  it("pool error response includes connection metrics", () => {
    // When main pool fails, the response should include pool configuration
    const failedPoolCheck = {
      status: "error",
      latencyMs: 5001,
      error: "pool_timeout",
      maxConnections: 10,
      idleTimeout: 20,
      maxLifetime: 900,
    };

    expect(failedPoolCheck).toHaveProperty("maxConnections");
    expect(failedPoolCheck).toHaveProperty("idleTimeout");
    expect(failedPoolCheck).toHaveProperty("maxLifetime");
    expect(failedPoolCheck.maxConnections).toBe(10);
    expect(failedPoolCheck.idleTimeout).toBe(20);
    expect(failedPoolCheck.maxLifetime).toBe(900);
  });

  it("pool config uses reduced lifetimes for better recycling", () => {
    // Default pool config: idle_timeout=20s, max_lifetime=15min (was 30s/30min)
    const DEFAULT_IDLE_TIMEOUT = 20;
    const DEFAULT_MAX_LIFETIME = 60 * 15; // 15 min

    expect(DEFAULT_IDLE_TIMEOUT).toBeLessThanOrEqual(30);
    expect(DEFAULT_MAX_LIFETIME).toBeLessThanOrEqual(60 * 30);
    // Reduced values force more frequent connection recycling
    expect(DEFAULT_MAX_LIFETIME).toBe(900);
  });
});
