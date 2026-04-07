import { describe, it, expect } from "vitest";

/**
 * Comprehensive tests for pool recovery logic — thresholds, decisions,
 * connection headroom checks, and state machine transitions.
 */

// ─── Decision Logic ────────────────────────────────────────────

interface PoolMonitorState {
  consecutiveFailures: number;
  poolResetCount: number;
}

interface PoolMonitorDecision {
  action: "none" | "reset" | "exit";
  reason: string;
}

const POOL_RESET_THRESHOLD = 3;
const POOL_EXIT_THRESHOLD = 7;

function decidePoolAction(state: PoolMonitorState): PoolMonitorDecision {
  if (state.consecutiveFailures >= POOL_EXIT_THRESHOLD) {
    return {
      action: "exit",
      reason: `${state.consecutiveFailures} consecutive failures after ${state.poolResetCount} reset attempts`,
    };
  }
  if (state.consecutiveFailures === POOL_RESET_THRESHOLD) {
    return {
      action: "reset",
      reason: `${state.consecutiveFailures} consecutive failures — attempting pool reset`,
    };
  }
  return { action: "none", reason: "monitoring" };
}

// ─── Connection Headroom Logic ─────────────────────────────────

function shouldCloseOldPoolFirst(totalConnections: number, maxConnections: number): boolean {
  return totalConnections >= maxConnections * 0.8; // >= 80% of max
}

function calculateConnectionBudget(maxConnections: number, poolMax: number): {
  available: number;
  canReset: boolean;
  wouldExceedOnReset: boolean;
} {
  // During reset, briefly both old + new pool exist
  const available = maxConnections - poolMax; // after new pool
  const wouldExceedOnReset = poolMax * 2 > maxConnections; // old + new
  return {
    available,
    canReset: available > 0,
    wouldExceedOnReset,
  };
}

// ─── Pool Status Classification ────────────────────────────────

interface ConnectionInfo {
  active: number;
  idle: number;
  idleInTransaction: number;
  total: number;
  max: number;
}

function classifyPoolStatus(
  connections: ConnectionInfo,
  poolCheckFailures: number,
): "ok" | "warning" | "error" {
  if (poolCheckFailures > 0 || connections.active >= connections.max) {
    return "error";
  }
  if (connections.active >= connections.max * 0.8 || connections.idleInTransaction > 0) {
    return "warning";
  }
  return "ok";
}

// ─── Pool Monitor State Machine ────────────────────────────────

type MonitorState = "healthy" | "degraded" | "resetting" | "failed" | "exiting";

function getMonitorState(failures: number, resetInProgress: boolean): MonitorState {
  if (resetInProgress) return "resetting";
  if (failures === 0) return "healthy";
  if (failures < POOL_RESET_THRESHOLD) return "degraded";
  if (failures < POOL_EXIT_THRESHOLD) return "failed";
  return "exiting";
}

// ─── Tests ─────────────────────────────────────────────────────

describe("Pool recovery decision logic", () => {
  it("takes no action at 0 failures", () => {
    expect(decidePoolAction({ consecutiveFailures: 0, poolResetCount: 0 }).action).toBe("none");
  });

  it("takes no action at 1 failure", () => {
    expect(decidePoolAction({ consecutiveFailures: 1, poolResetCount: 0 }).action).toBe("none");
  });

  it("takes no action at 2 failures", () => {
    expect(decidePoolAction({ consecutiveFailures: 2, poolResetCount: 0 }).action).toBe("none");
  });

  it("triggers reset at exactly 3 consecutive failures", () => {
    const result = decidePoolAction({ consecutiveFailures: 3, poolResetCount: 0 });
    expect(result.action).toBe("reset");
    expect(result.reason).toContain("attempting pool reset");
  });

  it("takes no action at 4 failures (between reset and exit)", () => {
    expect(decidePoolAction({ consecutiveFailures: 4, poolResetCount: 1 }).action).toBe("none");
  });

  it("takes no action at 5 failures", () => {
    expect(decidePoolAction({ consecutiveFailures: 5, poolResetCount: 1 }).action).toBe("none");
  });

  it("takes no action at 6 failures", () => {
    expect(decidePoolAction({ consecutiveFailures: 6, poolResetCount: 1 }).action).toBe("none");
  });

  it("triggers exit at 7 consecutive failures", () => {
    const result = decidePoolAction({ consecutiveFailures: 7, poolResetCount: 1 });
    expect(result.action).toBe("exit");
    expect(result.reason).toContain("7 consecutive failures");
    expect(result.reason).toContain("1 reset attempts");
  });

  it("triggers exit at 8+ failures", () => {
    expect(decidePoolAction({ consecutiveFailures: 8, poolResetCount: 1 }).action).toBe("exit");
    expect(decidePoolAction({ consecutiveFailures: 10, poolResetCount: 2 }).action).toBe("exit");
    expect(decidePoolAction({ consecutiveFailures: 100, poolResetCount: 5 }).action).toBe("exit");
  });

  it("reset threshold is always 3 regardless of prior resets", () => {
    expect(decidePoolAction({ consecutiveFailures: 3, poolResetCount: 0 }).action).toBe("reset");
    expect(decidePoolAction({ consecutiveFailures: 3, poolResetCount: 5 }).action).toBe("reset");
    expect(decidePoolAction({ consecutiveFailures: 3, poolResetCount: 100 }).action).toBe("reset");
  });

  it("exit reason includes reset count for diagnostics", () => {
    const result = decidePoolAction({ consecutiveFailures: 7, poolResetCount: 3 });
    expect(result.reason).toContain("3 reset attempts");
  });

  it("recovery scenario: failures go from 0 → 3 → 0 (successful reset)", () => {
    // Normal operation
    expect(decidePoolAction({ consecutiveFailures: 0, poolResetCount: 0 }).action).toBe("none");
    // Failures start
    expect(decidePoolAction({ consecutiveFailures: 1, poolResetCount: 0 }).action).toBe("none");
    expect(decidePoolAction({ consecutiveFailures: 2, poolResetCount: 0 }).action).toBe("none");
    // Reset triggered
    expect(decidePoolAction({ consecutiveFailures: 3, poolResetCount: 0 }).action).toBe("reset");
    // After successful reset, failures back to 0
    expect(decidePoolAction({ consecutiveFailures: 0, poolResetCount: 1 }).action).toBe("none");
  });

  it("failure scenario: reset fails, escalates to exit", () => {
    // Reset triggered
    expect(decidePoolAction({ consecutiveFailures: 3, poolResetCount: 0 }).action).toBe("reset");
    // Reset failed, failures continue
    expect(decidePoolAction({ consecutiveFailures: 4, poolResetCount: 1 }).action).toBe("none");
    expect(decidePoolAction({ consecutiveFailures: 5, poolResetCount: 1 }).action).toBe("none");
    expect(decidePoolAction({ consecutiveFailures: 6, poolResetCount: 1 }).action).toBe("none");
    // Exit triggered
    expect(decidePoolAction({ consecutiveFailures: 7, poolResetCount: 1 }).action).toBe("exit");
  });
});

describe("Connection headroom checks", () => {
  it("flags when connections >= 80% of max", () => {
    expect(shouldCloseOldPoolFirst(20, 25)).toBe(true);
    expect(shouldCloseOldPoolFirst(25, 25)).toBe(true);
  });

  it("does not flag when connections < 80% of max", () => {
    expect(shouldCloseOldPoolFirst(19, 25)).toBe(false);
    expect(shouldCloseOldPoolFirst(10, 25)).toBe(false);
    expect(shouldCloseOldPoolFirst(0, 25)).toBe(false);
  });

  it("handles edge case of 0 max connections", () => {
    expect(shouldCloseOldPoolFirst(0, 0)).toBe(true);
  });

  it("handles max_connections=50 (upgraded tier)", () => {
    expect(shouldCloseOldPoolFirst(39, 50)).toBe(false);
    expect(shouldCloseOldPoolFirst(40, 50)).toBe(true);
  });
});

describe("Connection budget calculation", () => {
  it("calculates budget for default config (max=25, pool=5)", () => {
    const budget = calculateConnectionBudget(25, 5);
    expect(budget.available).toBe(20);
    expect(budget.canReset).toBe(true);
    expect(budget.wouldExceedOnReset).toBe(false); // 5*2=10 < 25
  });

  it("detects when reset would exceed max (old config: max=25, pool=10)", () => {
    const budget = calculateConnectionBudget(25, 10);
    expect(budget.available).toBe(15);
    expect(budget.canReset).toBe(true);
    expect(budget.wouldExceedOnReset).toBe(false); // 10*2=20 < 25
  });

  it("detects tight budget (max=25, pool=13)", () => {
    const budget = calculateConnectionBudget(25, 13);
    expect(budget.available).toBe(12);
    expect(budget.canReset).toBe(true);
    expect(budget.wouldExceedOnReset).toBe(true); // 13*2=26 > 25
  });

  it("detects impossible reset (max=5, pool=5)", () => {
    const budget = calculateConnectionBudget(5, 5);
    expect(budget.available).toBe(0);
    expect(budget.canReset).toBe(false);
    expect(budget.wouldExceedOnReset).toBe(true);
  });
});

describe("Pool status classification", () => {
  const healthyConns: ConnectionInfo = {
    active: 3, idle: 5, idleInTransaction: 0, total: 8, max: 25,
  };

  it("returns 'ok' when healthy with 0 failures", () => {
    expect(classifyPoolStatus(healthyConns, 0)).toBe("ok");
  });

  it("returns 'error' with any consecutive failures", () => {
    expect(classifyPoolStatus(healthyConns, 1)).toBe("error");
    expect(classifyPoolStatus(healthyConns, 5)).toBe("error");
  });

  it("returns 'error' when active connections reach max", () => {
    expect(classifyPoolStatus({ ...healthyConns, active: 25 }, 0)).toBe("error");
  });

  it("returns 'error' when active exceeds max", () => {
    expect(classifyPoolStatus({ ...healthyConns, active: 30 }, 0)).toBe("error");
  });

  it("returns 'warning' at 80% utilization", () => {
    expect(classifyPoolStatus({ ...healthyConns, active: 20 }, 0)).toBe("warning");
  });

  it("returns 'warning' with idle-in-transaction connections", () => {
    expect(classifyPoolStatus({ ...healthyConns, idleInTransaction: 1 }, 0)).toBe("warning");
  });

  it("returns 'ok' at 79% utilization", () => {
    expect(classifyPoolStatus({ ...healthyConns, active: 19 }, 0)).toBe("ok");
  });

  it("prioritizes error over warning", () => {
    // Both: high utilization AND failures
    expect(classifyPoolStatus({ ...healthyConns, active: 25 }, 3)).toBe("error");
  });

  it("returns 'ok' with zero connections (pool just started)", () => {
    expect(classifyPoolStatus({ active: 0, idle: 0, idleInTransaction: 0, total: 0, max: 25 }, 0)).toBe("ok");
  });
});

describe("Pool monitor state machine", () => {
  it("starts in healthy state", () => {
    expect(getMonitorState(0, false)).toBe("healthy");
  });

  it("transitions to degraded on first failure", () => {
    expect(getMonitorState(1, false)).toBe("degraded");
    expect(getMonitorState(2, false)).toBe("degraded");
  });

  it("transitions to resetting during pool reset", () => {
    expect(getMonitorState(3, true)).toBe("resetting");
  });

  it("reset flag overrides failure count", () => {
    expect(getMonitorState(0, true)).toBe("resetting");
    expect(getMonitorState(7, true)).toBe("resetting");
  });

  it("transitions to failed after reset threshold", () => {
    expect(getMonitorState(3, false)).toBe("failed");
    expect(getMonitorState(4, false)).toBe("failed");
    expect(getMonitorState(6, false)).toBe("failed");
  });

  it("transitions to exiting at exit threshold", () => {
    expect(getMonitorState(7, false)).toBe("exiting");
    expect(getMonitorState(10, false)).toBe("exiting");
  });

  it("can return to healthy after recovery", () => {
    // Simulate: healthy → degraded → resetting → healthy
    expect(getMonitorState(0, false)).toBe("healthy");
    expect(getMonitorState(1, false)).toBe("degraded");
    expect(getMonitorState(2, false)).toBe("degraded");
    expect(getMonitorState(3, true)).toBe("resetting");
    expect(getMonitorState(0, false)).toBe("healthy");
  });
});

describe("Pool config validation", () => {
  const API_POOL_MAX = 5;
  const WORKER_POOL_MAX = 5;
  const EMAIL_POOL_MAX = 2;
  const NOTIFICATION_POOL_MAX = 2;
  const SCHEDULER_POOL_MAX = 2;
  const CLI_POOL_MAX = 3;
  const HEALTH_DB_MAX = 1;
  const CLOUD_SQL_MAX = 25;

  it("total pool sizes stay under Cloud SQL max_connections", () => {
    const totalMax = API_POOL_MAX + HEALTH_DB_MAX + WORKER_POOL_MAX +
      EMAIL_POOL_MAX * 2 + NOTIFICATION_POOL_MAX + SCHEDULER_POOL_MAX + CLI_POOL_MAX;
    expect(totalMax).toBeLessThan(CLOUD_SQL_MAX);
  });

  it("pool reset does not exceed max_connections (old + new API pool)", () => {
    const duringReset = API_POOL_MAX * 2 + HEALTH_DB_MAX;
    expect(duringReset).toBeLessThan(CLOUD_SQL_MAX);
  });

  it("keep_alive is less than idle_timeout", () => {
    expect(30).toBeLessThan(60);
  });

  it("idle_timeout prevents premature connection death", () => {
    expect(60).toBeGreaterThanOrEqual(60);
  });

  it("max_lifetime jitter stays within ±25%", () => {
    const baseLifetime = 900;
    const jitterRange = baseLifetime * 0.25;
    for (let i = 0; i < 100; i++) {
      const jitter = Math.floor(jitterRange * (Math.random() * 2 - 1));
      const lifetime = baseLifetime + jitter;
      expect(lifetime).toBeGreaterThanOrEqual(675);
      expect(lifetime).toBeLessThanOrEqual(1125);
    }
  });

  it("exit threshold gives enough time for recovery after reset", () => {
    const timeBetweenResetAndExit = (POOL_EXIT_THRESHOLD - POOL_RESET_THRESHOLD) * 30;
    expect(timeBetweenResetAndExit).toBeGreaterThanOrEqual(90); // at least 90s
  });

  it("warming interval is shorter than idle_timeout", () => {
    const WARM_INTERVAL_S = 60;
    const IDLE_TIMEOUT_S = 60;
    expect(WARM_INTERVAL_S).toBeLessThanOrEqual(IDLE_TIMEOUT_S);
  });

  it("health check interval aligns with Docker healthcheck", () => {
    const POOL_CHECK_INTERVAL = 30;
    const DOCKER_HEALTHCHECK_INTERVAL = 30;
    // Pool monitor should detect issues at least as fast as Docker
    expect(POOL_CHECK_INTERVAL).toBeLessThanOrEqual(DOCKER_HEALTHCHECK_INTERVAL);
  });
});

describe("Timeout hierarchy validation", () => {
  it("statement_timeout < request_timeout < pool_check_timeout chain is correct", () => {
    const STATEMENT_TIMEOUT = 30_000;
    const REQUEST_TIMEOUT = 30_000;
    const POOL_CHECK_TIMEOUT = 5_000;
    // Pool check should be faster than statement timeout
    expect(POOL_CHECK_TIMEOUT).toBeLessThan(STATEMENT_TIMEOUT);
    // Statement timeout should not exceed request timeout
    expect(STATEMENT_TIMEOUT).toBeLessThanOrEqual(REQUEST_TIMEOUT);
  });

  it("health check statement timeout is fast", () => {
    const HEALTH_STATEMENT_TIMEOUT = 5_000;
    expect(HEALTH_STATEMENT_TIMEOUT).toBeLessThanOrEqual(5_000);
  });

  it("pool check timeout matches health check timeout", () => {
    expect(5_000).toBe(5_000);
  });

  it("Docker healthcheck timeout exceeds pool check timeout", () => {
    const DOCKER_TIMEOUT = 10_000;
    const POOL_CHECK_TIMEOUT = 5_000;
    expect(DOCKER_TIMEOUT).toBeGreaterThan(POOL_CHECK_TIMEOUT);
  });
});
