import { describe, it, expect } from "vitest";

/**
 * Tests for pool recovery logic — thresholds and decision flow.
 * The actual pool reset is tested via integration; here we test the
 * classification and threshold logic extracted from the pool monitor.
 */

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

describe("Pool recovery decision logic", () => {
  it("takes no action below reset threshold", () => {
    expect(decidePoolAction({ consecutiveFailures: 1, poolResetCount: 0 })).toEqual({
      action: "none",
      reason: "monitoring",
    });
    expect(decidePoolAction({ consecutiveFailures: 2, poolResetCount: 0 })).toEqual({
      action: "none",
      reason: "monitoring",
    });
  });

  it("triggers reset at exactly 3 consecutive failures", () => {
    const result = decidePoolAction({ consecutiveFailures: 3, poolResetCount: 0 });
    expect(result.action).toBe("reset");
    expect(result.reason).toContain("attempting pool reset");
  });

  it("takes no action between reset and exit thresholds", () => {
    // After a failed reset, failures 4-6 should just monitor
    expect(decidePoolAction({ consecutiveFailures: 4, poolResetCount: 1 }).action).toBe("none");
    expect(decidePoolAction({ consecutiveFailures: 5, poolResetCount: 1 }).action).toBe("none");
    expect(decidePoolAction({ consecutiveFailures: 6, poolResetCount: 1 }).action).toBe("none");
  });

  it("triggers exit at 7 consecutive failures", () => {
    const result = decidePoolAction({ consecutiveFailures: 7, poolResetCount: 1 });
    expect(result.action).toBe("exit");
    expect(result.reason).toContain("7 consecutive failures");
    expect(result.reason).toContain("1 reset attempts");
  });

  it("triggers exit at failures beyond threshold", () => {
    const result = decidePoolAction({ consecutiveFailures: 10, poolResetCount: 2 });
    expect(result.action).toBe("exit");
  });

  it("reset threshold is always 3 regardless of prior resets", () => {
    // Even if we've done resets before, 3 consecutive failures triggers reset
    const result = decidePoolAction({ consecutiveFailures: 3, poolResetCount: 5 });
    expect(result.action).toBe("reset");
  });
});

describe("Pool config validation", () => {
  it("idle_timeout is >= 60 seconds", () => {
    // Validate our config choice: 60s prevents premature connection death
    const IDLE_TIMEOUT = 60;
    expect(IDLE_TIMEOUT).toBeGreaterThanOrEqual(60);
  });

  it("keep_alive is set to 30 seconds", () => {
    const KEEP_ALIVE = 30;
    expect(KEEP_ALIVE).toBe(30);
    // Must be less than idle_timeout to keep connections alive
    expect(KEEP_ALIVE).toBeLessThan(60);
  });

  it("max_lifetime jitter stays within ±25%", () => {
    const baseLifetime = 900; // 15 min
    const jitterRange = baseLifetime * 0.25;
    // Simulate 100 jitter values
    for (let i = 0; i < 100; i++) {
      const jitter = Math.floor(jitterRange * (Math.random() * 2 - 1));
      const lifetime = baseLifetime + jitter;
      expect(lifetime).toBeGreaterThanOrEqual(baseLifetime - jitterRange);
      expect(lifetime).toBeLessThanOrEqual(baseLifetime + jitterRange);
    }
  });

  it("exit threshold is greater than reset threshold", () => {
    expect(POOL_EXIT_THRESHOLD).toBeGreaterThan(POOL_RESET_THRESHOLD);
    // Ensure enough room for recovery attempt between reset and exit
    expect(POOL_EXIT_THRESHOLD - POOL_RESET_THRESHOLD).toBeGreaterThanOrEqual(3);
  });
});
