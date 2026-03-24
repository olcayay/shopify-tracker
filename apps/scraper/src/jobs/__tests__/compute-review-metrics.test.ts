import { describe, it, expect } from "vitest";

/**
 * computeMetrics is a private function in compute-review-metrics.ts.
 * We replicate it here for unit testing since it contains the core logic.
 */
function computeMetrics(v7d: number, v30d: number, v90d: number) {
  const expected7dFrom30d = v30d / (30 / 7);
  const accMicro = Math.round((v7d - expected7dFrom30d) * 100) / 100;

  const expected30dFrom90d = v90d / 3;
  const accMacro = Math.round((v30d - expected30dFrom90d) * 100) / 100;

  let momentum: string;
  if (v30d === 0 && v7d === 0) {
    momentum = "flat";
  } else if (expected7dFrom30d > 0 && accMicro > expected7dFrom30d) {
    momentum = "spike";
  } else if (accMicro > 0 && accMacro > 0) {
    momentum = "accelerating";
  } else if (accMicro < 0 || accMacro < 0) {
    momentum = "slowing";
  } else {
    momentum = "stable";
  }

  return { v7d, v30d, v90d, accMicro, accMacro, momentum };
}

describe("computeMetrics", () => {
  it("returns flat when v7d and v30d are both 0", () => {
    const result = computeMetrics(0, 0, 0);
    expect(result.momentum).toBe("flat");
    expect(result.accMicro).toBe(0);
    expect(result.accMacro).toBe(0);
  });

  it("returns flat when all zeros", () => {
    const result = computeMetrics(0, 0, 100);
    expect(result.momentum).toBe("flat");
  });

  it("returns spike when 7d pace is >2x the 30d-normalized pace", () => {
    // v30d = 30, expected7dFrom30d = 30 / 4.285 ≈ 7
    // v7d = 20 => accMicro = 20 - 7 = 13 > 7 (expected7dFrom30d) => spike
    const result = computeMetrics(20, 30, 90);
    expect(result.momentum).toBe("spike");
  });

  it("returns accelerating when both accMicro and accMacro are positive", () => {
    // v7d=10, v30d=40, v90d=90
    // expected7dFrom30d = 40 / 4.285 ≈ 9.33
    // accMicro = 10 - 9.33 = 0.67 > 0
    // expected30dFrom90d = 90 / 3 = 30
    // accMacro = 40 - 30 = 10 > 0
    // accMicro (0.67) < expected7dFrom30d (9.33) so NOT spike
    const result = computeMetrics(10, 40, 90);
    expect(result.momentum).toBe("accelerating");
    expect(result.accMicro).toBeGreaterThan(0);
    expect(result.accMacro).toBeGreaterThan(0);
  });

  it("returns slowing when accMicro is negative", () => {
    // v7d=2, v30d=30, v90d=90
    // expected7dFrom30d = 30 / 4.285 ≈ 7
    // accMicro = 2 - 7 = -5 < 0
    const result = computeMetrics(2, 30, 90);
    expect(result.momentum).toBe("slowing");
    expect(result.accMicro).toBeLessThan(0);
  });

  it("returns slowing when accMacro is negative", () => {
    // v7d=8, v30d=20, v90d=90
    // expected7dFrom30d = 20 / 4.285 ≈ 4.67
    // accMicro = 8 - 4.67 = 3.33 > 0
    // expected30dFrom90d = 90 / 3 = 30
    // accMacro = 20 - 30 = -10 < 0
    const result = computeMetrics(8, 20, 90);
    expect(result.momentum).toBe("slowing");
    expect(result.accMacro).toBeLessThan(0);
  });

  it("returns stable when neither accelerating nor slowing", () => {
    // v7d=7, v30d=30, v90d=90
    // expected7dFrom30d = 30 / 4.285 ≈ 7
    // accMicro = 7 - 7 ≈ 0
    // expected30dFrom90d = 90 / 3 = 30
    // accMacro = 30 - 30 = 0
    const result = computeMetrics(7, 30, 90);
    expect(result.momentum).toBe("stable");
  });

  it("preserves original v7d, v30d, v90d in result", () => {
    const result = computeMetrics(5, 15, 45);
    expect(result.v7d).toBe(5);
    expect(result.v30d).toBe(15);
    expect(result.v90d).toBe(45);
  });

  it("computes accMicro correctly", () => {
    // v7d=10, v30d=30
    // expected7dFrom30d = 30 / (30/7) = 7
    // accMicro = 10 - 7 = 3
    const result = computeMetrics(10, 30, 90);
    expect(result.accMicro).toBe(3);
  });

  it("computes accMacro correctly", () => {
    // v30d=40, v90d=90
    // expected30dFrom90d = 90 / 3 = 30
    // accMacro = 40 - 30 = 10
    const result = computeMetrics(10, 40, 90);
    expect(result.accMacro).toBe(10);
  });

  it("rounds accMicro to 2 decimal places", () => {
    const result = computeMetrics(3, 10, 30);
    // expected7dFrom30d = 10 / 4.2857... = 2.3333...
    // accMicro = 3 - 2.3333... = 0.6666... → 0.67
    expect(result.accMicro).toBe(0.67);
  });

  it("rounds accMacro to 2 decimal places", () => {
    const result = computeMetrics(3, 10, 31);
    // expected30dFrom90d = 31 / 3 = 10.3333...
    // accMacro = 10 - 10.3333... = -0.3333... → -0.33
    expect(result.accMacro).toBe(-0.33);
  });

  it("handles very large review counts", () => {
    const result = computeMetrics(500, 2000, 6000);
    expect(result.momentum).toBeDefined();
    expect(typeof result.accMicro).toBe("number");
    expect(typeof result.accMacro).toBe("number");
  });

  it("handles v90d of 0 (accMacro = v30d)", () => {
    const result = computeMetrics(5, 10, 0);
    // expected30dFrom90d = 0/3 = 0
    // accMacro = 10 - 0 = 10
    expect(result.accMacro).toBe(10);
  });
});
