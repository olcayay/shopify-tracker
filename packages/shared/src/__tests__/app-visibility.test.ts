import { describe, it, expect } from "vitest";
import {
  computeRankWeight,
  computeAppVisibility,
  normalizeScore,
  PAGE_SIZE,
  PAGE_DECAY,
} from "../app-visibility.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe("constants", () => {
  it("PAGE_SIZE is 24", () => {
    expect(PAGE_SIZE).toBe(24);
  });

  it("PAGE_DECAY is 0.3", () => {
    expect(PAGE_DECAY).toBe(0.3);
  });
});

// ---------------------------------------------------------------------------
// computeRankWeight
// ---------------------------------------------------------------------------
describe("computeRankWeight", () => {
  it("returns highest weight for position 1", () => {
    const w1 = computeRankWeight(1);
    const w2 = computeRankWeight(2);
    expect(w1).toBeGreaterThan(w2);
  });

  it("position 1 is 1/log2(2) = 1.0", () => {
    expect(computeRankWeight(1)).toBeCloseTo(1.0, 10);
  });

  it("position 2 is 1/log2(3)", () => {
    expect(computeRankWeight(2)).toBeCloseTo(1 / Math.log2(3), 10);
  });

  it("applies no page penalty on first page (positions 1-24)", () => {
    // All positions 1-24 should have pagePenalty = 0.3^0 = 1
    for (let pos = 1; pos <= PAGE_SIZE; pos++) {
      const expected = 1 / Math.log2(pos + 1);
      expect(computeRankWeight(pos)).toBeCloseTo(expected, 10);
    }
  });

  it("applies page penalty at page boundary (position 25)", () => {
    // Position 25 is on page 1 (0-indexed), penalty = 0.3^1 = 0.3
    const w25 = computeRankWeight(25);
    const expected = (1 / Math.log2(26)) * PAGE_DECAY;
    expect(w25).toBeCloseTo(expected, 10);
  });

  it("position 25 is dramatically less than position 24", () => {
    const w24 = computeRankWeight(24);
    const w25 = computeRankWeight(25);
    // Page decay should cause a big drop
    expect(w24 / w25).toBeGreaterThan(2);
  });

  it("applies double page penalty on third page (position 49)", () => {
    const w49 = computeRankWeight(49);
    const expected = (1 / Math.log2(50)) * Math.pow(PAGE_DECAY, 2);
    expect(w49).toBeCloseTo(expected, 10);
  });

  it("weights decrease monotonically within the same page", () => {
    for (let pos = 1; pos < PAGE_SIZE; pos++) {
      expect(computeRankWeight(pos)).toBeGreaterThan(computeRankWeight(pos + 1));
    }
  });

  it("position 100 has very small weight", () => {
    const w = computeRankWeight(100);
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThan(0.01);
  });
});

// ---------------------------------------------------------------------------
// computeAppVisibility
// ---------------------------------------------------------------------------
describe("computeAppVisibility", () => {
  it("returns zero for empty rankings", () => {
    const result = computeAppVisibility([]);
    expect(result.visibilityRaw).toBe(0);
    expect(result.keywordCount).toBe(0);
  });

  it("computes visibility for a single ranking", () => {
    const result = computeAppVisibility([{ totalResults: 100, position: 1 }]);
    expect(result.keywordCount).toBe(1);
    // visibility = 100 * 1.0 (rank weight for pos 1)
    expect(result.visibilityRaw).toBeCloseTo(100, 2);
  });

  it("sums visibility across multiple rankings", () => {
    const rankings = [
      { totalResults: 100, position: 1 },
      { totalResults: 200, position: 1 },
    ];
    const result = computeAppVisibility(rankings);
    expect(result.keywordCount).toBe(2);
    expect(result.visibilityRaw).toBeCloseTo(300, 2);
  });

  it("discounts lower positions", () => {
    const high = computeAppVisibility([{ totalResults: 100, position: 1 }]);
    const low = computeAppVisibility([{ totalResults: 100, position: 10 }]);
    expect(high.visibilityRaw).toBeGreaterThan(low.visibilityRaw);
  });

  it("skips rankings with position < 1", () => {
    const result = computeAppVisibility([
      { totalResults: 100, position: 0 },
      { totalResults: 100, position: -1 },
      { totalResults: 100, position: 1 },
    ]);
    expect(result.keywordCount).toBe(1);
  });

  it("skips rankings with totalResults <= 0", () => {
    const result = computeAppVisibility([
      { totalResults: 0, position: 1 },
      { totalResults: -5, position: 1 },
      { totalResults: 100, position: 1 },
    ]);
    expect(result.keywordCount).toBe(1);
  });

  it("rounds visibilityRaw to 4 decimal places", () => {
    const result = computeAppVisibility([{ totalResults: 33, position: 3 }]);
    const raw = result.visibilityRaw;
    expect(raw).toBe(Math.round(raw * 10000) / 10000);
  });

  it("higher totalResults produces higher visibility", () => {
    const low = computeAppVisibility([{ totalResults: 50, position: 5 }]);
    const high = computeAppVisibility([{ totalResults: 500, position: 5 }]);
    expect(high.visibilityRaw).toBeGreaterThan(low.visibilityRaw);
  });
});

// ---------------------------------------------------------------------------
// normalizeScore
// ---------------------------------------------------------------------------
describe("normalizeScore", () => {
  it("returns 0 when maxRaw is 0", () => {
    expect(normalizeScore(50, 0)).toBe(0);
  });

  it("returns 0 when maxRaw is negative", () => {
    expect(normalizeScore(50, -10)).toBe(0);
  });

  it("returns 100 when raw equals maxRaw", () => {
    expect(normalizeScore(200, 200)).toBe(100);
  });

  it("returns 50 when raw is half of maxRaw", () => {
    expect(normalizeScore(100, 200)).toBe(50);
  });

  it("rounds to nearest integer", () => {
    expect(normalizeScore(1, 3)).toBe(33);
  });

  it("returns 0 for raw of 0", () => {
    expect(normalizeScore(0, 100)).toBe(0);
  });

  it("can exceed 100 if raw exceeds maxRaw", () => {
    expect(normalizeScore(200, 100)).toBe(200);
  });
});
