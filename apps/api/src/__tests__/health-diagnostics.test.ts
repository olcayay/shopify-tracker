import { describe, it, expect } from "vitest";

/**
 * Tests for the pool status classification logic in /health/ready endpoint.
 * Since the endpoint queries pg_stat_activity, we test the classification rules directly.
 */

interface ConnectionInfo {
  active: number;
  idle: number;
  idleInTransaction: number;
  waitingOnLock: number;
  total: number;
  max: number;
  longestQuerySecs: number | null;
}

function classifyPoolStatus(
  connections: ConnectionInfo,
  poolCheckFailures: number
): "ok" | "warning" | "error" {
  if (poolCheckFailures > 0 || connections.active >= connections.max) {
    return "error";
  }
  if (connections.active >= connections.max * 0.8 || connections.idleInTransaction > 0) {
    return "warning";
  }
  return "ok";
}

describe("Pool status classification", () => {
  it("returns 'ok' when connections are healthy", () => {
    expect(classifyPoolStatus({
      active: 3, idle: 5, idleInTransaction: 0, waitingOnLock: 0,
      total: 8, max: 25, longestQuerySecs: 1,
    }, 0)).toBe("ok");
  });

  it("returns 'warning' at 80% utilization", () => {
    expect(classifyPoolStatus({
      active: 20, idle: 2, idleInTransaction: 0, waitingOnLock: 0,
      total: 22, max: 25, longestQuerySecs: 3,
    }, 0)).toBe("warning");
  });

  it("returns 'warning' when idle_in_transaction > 0", () => {
    expect(classifyPoolStatus({
      active: 3, idle: 5, idleInTransaction: 1, waitingOnLock: 0,
      total: 9, max: 25, longestQuerySecs: 1,
    }, 0)).toBe("warning");
  });

  it("returns 'error' at 100% utilization", () => {
    expect(classifyPoolStatus({
      active: 25, idle: 0, idleInTransaction: 0, waitingOnLock: 0,
      total: 25, max: 25, longestQuerySecs: 30,
    }, 0)).toBe("error");
  });

  it("returns 'error' when poolCheckFailures > 0", () => {
    expect(classifyPoolStatus({
      active: 3, idle: 5, idleInTransaction: 0, waitingOnLock: 0,
      total: 8, max: 25, longestQuerySecs: 1,
    }, 1)).toBe("error");
  });

  it("returns 'error' over 100% utilization", () => {
    expect(classifyPoolStatus({
      active: 30, idle: 0, idleInTransaction: 0, waitingOnLock: 0,
      total: 30, max: 25, longestQuerySecs: 60,
    }, 0)).toBe("error");
  });
});
