import { describe, it, expect } from "vitest";
import {
  computeCategoryRankScore,
  computeAppPower,
  computeWeightedPowerScore,
  POWER_WEIGHTS,
} from "../app-power.js";
import { PAGE_SIZE } from "../app-visibility.js";

// ---------------------------------------------------------------------------
// POWER_WEIGHTS
// ---------------------------------------------------------------------------
describe("POWER_WEIGHTS", () => {
  it("weights sum to 1.0", () => {
    const sum =
      POWER_WEIGHTS.rating +
      POWER_WEIGHTS.review +
      POWER_WEIGHTS.category +
      POWER_WEIGHTS.momentum;
    expect(sum).toBeCloseTo(1, 10);
  });

  it("rating has highest weight", () => {
    expect(POWER_WEIGHTS.rating).toBe(0.35);
  });

  it("review and category have equal weight", () => {
    expect(POWER_WEIGHTS.review).toBe(POWER_WEIGHTS.category);
    expect(POWER_WEIGHTS.review).toBe(0.25);
  });

  it("momentum has lowest weight", () => {
    expect(POWER_WEIGHTS.momentum).toBe(0.15);
  });
});

// ---------------------------------------------------------------------------
// computeCategoryRankScore
// ---------------------------------------------------------------------------
describe("computeCategoryRankScore", () => {
  it("returns 0 for totalApps <= 0", () => {
    expect(computeCategoryRankScore({ position: 1, totalApps: 0 })).toBe(0);
    expect(computeCategoryRankScore({ position: 1, totalApps: -1 })).toBe(0);
  });

  it("returns 0 for position < 1", () => {
    expect(computeCategoryRankScore({ position: 0, totalApps: 100 })).toBe(0);
    expect(computeCategoryRankScore({ position: -1, totalApps: 100 })).toBe(0);
  });

  it("returns 0 when position exceeds totalApps", () => {
    expect(computeCategoryRankScore({ position: 101, totalApps: 100 })).toBe(0);
  });

  it("returns highest score for position 1", () => {
    const s1 = computeCategoryRankScore({ position: 1, totalApps: 100 });
    const s2 = computeCategoryRankScore({ position: 2, totalApps: 100 });
    expect(s1).toBeGreaterThan(s2);
  });

  it("position 1 returns sqrt(1/log2(2)) = 1.0", () => {
    const score = computeCategoryRankScore({ position: 1, totalApps: 100 });
    expect(score).toBeCloseTo(Math.sqrt(1 / Math.log2(2)), 10);
    expect(score).toBeCloseTo(1.0, 10);
  });

  it("scores decrease monotonically within the first page", () => {
    for (let pos = 1; pos < PAGE_SIZE; pos++) {
      const a = computeCategoryRankScore({ position: pos, totalApps: 100 });
      const b = computeCategoryRankScore({ position: pos + 1, totalApps: 100 });
      expect(a).toBeGreaterThan(b);
    }
  });

  it("applies page penalty for position 25+ (page 1)", () => {
    const s24 = computeCategoryRankScore({ position: 24, totalApps: 200 });
    const s25 = computeCategoryRankScore({ position: 25, totalApps: 200 });
    // Page penalty = 0.5 (POWER_PAGE_DECAY), so there's a discontinuity
    expect(s24).toBeGreaterThan(s25);
  });

  it("all scores are in [0, 1] range", () => {
    for (const pos of [1, 5, 10, 24, 25, 50, 100]) {
      const score = computeCategoryRankScore({ position: pos, totalApps: 200 });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it("position equal to totalApps still returns a score", () => {
    const score = computeCategoryRankScore({ position: 50, totalApps: 50 });
    expect(score).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// computeAppPower
// ---------------------------------------------------------------------------
describe("computeAppPower", () => {
  const baseInput = {
    averageRating: null as number | null,
    ratingCount: null as number | null,
    categoryRankings: [] as { position: number; totalApps: number }[],
    accMacro: null as number | null,
  };

  it("returns all zeros for null/empty inputs", () => {
    const result = computeAppPower(baseInput, 0, 0);
    expect(result.ratingScore).toBe(0);
    expect(result.reviewScore).toBe(0);
    expect(result.categoryScore).toBe(0);
    expect(result.momentumScore).toBe(0);
    expect(result.powerRaw).toBe(0);
  });

  // -- Rating Component --
  it("rating 5.0 produces max ratingScore", () => {
    const input = { ...baseInput, averageRating: 5.0 };
    const result = computeAppPower(input, 0, 0);
    // (5-3)/2 = 1.0, 1.0^1.5 = 1.0
    expect(result.ratingScore).toBeCloseTo(1.0, 4);
  });

  it("rating 3.0 produces zero ratingScore (floor)", () => {
    const input = { ...baseInput, averageRating: 3.0 };
    const result = computeAppPower(input, 0, 0);
    expect(result.ratingScore).toBe(0);
  });

  it("rating below 3.0 is clamped to 0", () => {
    const input = { ...baseInput, averageRating: 2.0 };
    const result = computeAppPower(input, 0, 0);
    expect(result.ratingScore).toBe(0);
  });

  it("rating 4.0 produces correct score", () => {
    const input = { ...baseInput, averageRating: 4.0 };
    const result = computeAppPower(input, 0, 0);
    // (4-3)/2 = 0.5, 0.5^1.5 ≈ 0.3536
    expect(result.ratingScore).toBeCloseTo(Math.pow(0.5, 1.5), 4);
  });

  it("null rating produces 0 ratingScore", () => {
    const input = { ...baseInput, averageRating: null };
    const result = computeAppPower(input, 0, 0);
    expect(result.ratingScore).toBe(0);
  });

  // -- Review Component --
  it("reviewScore is normalized by maxReviewsInCategory", () => {
    const input = { ...baseInput, ratingCount: 100 };
    const result = computeAppPower(input, 1000, 0);
    const expected = Math.log10(101) / Math.log10(1001);
    expect(result.reviewScore).toBeCloseTo(expected, 4);
  });

  it("reviewScore is 0 when maxReviewsInCategory is 0", () => {
    const input = { ...baseInput, ratingCount: 100 };
    const result = computeAppPower(input, 0, 0);
    expect(result.reviewScore).toBe(0);
  });

  it("null ratingCount treated as 0 reviews", () => {
    const input = { ...baseInput, ratingCount: null };
    const result = computeAppPower(input, 1000, 0);
    const expected = Math.log10(1) / Math.log10(1001);
    expect(result.reviewScore).toBeCloseTo(expected, 4);
  });

  it("app with max reviews in category gets reviewScore = 1", () => {
    const input = { ...baseInput, ratingCount: 5000 };
    const result = computeAppPower(input, 5000, 0);
    expect(result.reviewScore).toBeCloseTo(1, 4);
  });

  // -- Category Component --
  it("single category ranking", () => {
    const input = {
      ...baseInput,
      categoryRankings: [{ position: 1, totalApps: 100 }],
    };
    const result = computeAppPower(input, 0, 0);
    expect(result.categoryScore).toBeCloseTo(1.0, 4);
  });

  it("two category rankings: 70/30 weighted blend", () => {
    const input = {
      ...baseInput,
      categoryRankings: [
        { position: 1, totalApps: 100 },
        { position: 10, totalApps: 100 },
      ],
    };
    const result = computeAppPower(input, 0, 0);
    const s1 = computeCategoryRankScore({ position: 1, totalApps: 100 });
    const s2 = computeCategoryRankScore({ position: 10, totalApps: 100 });
    const expected = 0.7 * s1 + 0.3 * s2;
    expect(result.categoryScore).toBeCloseTo(expected, 4);
  });

  it("two category rankings picks best first (regardless of order)", () => {
    const input1 = {
      ...baseInput,
      categoryRankings: [
        { position: 10, totalApps: 100 },
        { position: 1, totalApps: 100 },
      ],
    };
    const input2 = {
      ...baseInput,
      categoryRankings: [
        { position: 1, totalApps: 100 },
        { position: 10, totalApps: 100 },
      ],
    };
    const r1 = computeAppPower(input1, 0, 0);
    const r2 = computeAppPower(input2, 0, 0);
    expect(r1.categoryScore).toBeCloseTo(r2.categoryScore, 4);
  });

  it("no category rankings produces 0 categoryScore", () => {
    const result = computeAppPower(baseInput, 0, 0);
    expect(result.categoryScore).toBe(0);
  });

  // -- Momentum Component --
  it("positive accMacro produces positive momentumScore", () => {
    const input = { ...baseInput, accMacro: 5 };
    const result = computeAppPower(input, 0, 10);
    expect(result.momentumScore).toBeCloseTo(0.5, 4);
  });

  it("accMacro equal to max produces momentumScore = 1", () => {
    const input = { ...baseInput, accMacro: 10 };
    const result = computeAppPower(input, 0, 10);
    expect(result.momentumScore).toBeCloseTo(1, 4);
  });

  it("negative accMacro is clamped to 0", () => {
    const input = { ...baseInput, accMacro: -5 };
    const result = computeAppPower(input, 0, 10);
    expect(result.momentumScore).toBe(0);
  });

  it("null accMacro produces 0 momentumScore", () => {
    const input = { ...baseInput, accMacro: null };
    const result = computeAppPower(input, 0, 10);
    expect(result.momentumScore).toBe(0);
  });

  it("maxAccMacroInCategory = 0 produces 0 momentumScore", () => {
    const input = { ...baseInput, accMacro: 5 };
    const result = computeAppPower(input, 0, 0);
    expect(result.momentumScore).toBe(0);
  });

  // -- Weighted Sum --
  it("powerRaw is weighted sum of all components", () => {
    const input = {
      averageRating: 5.0,
      ratingCount: 1000,
      categoryRankings: [{ position: 1, totalApps: 100 }],
      accMacro: 10,
    };
    const result = computeAppPower(input, 1000, 10);
    const expected =
      POWER_WEIGHTS.rating * result.ratingScore +
      POWER_WEIGHTS.review * result.reviewScore +
      POWER_WEIGHTS.category * result.categoryScore +
      POWER_WEIGHTS.momentum * result.momentumScore;
    expect(result.powerRaw).toBeCloseTo(expected, 4);
  });

  it("all results are rounded to 4 decimal places", () => {
    const input = {
      averageRating: 4.3,
      ratingCount: 337,
      categoryRankings: [{ position: 7, totalApps: 50 }],
      accMacro: 3.7,
    };
    const result = computeAppPower(input, 2000, 8);
    for (const val of [
      result.ratingScore,
      result.reviewScore,
      result.categoryScore,
      result.momentumScore,
      result.powerRaw,
    ]) {
      expect(val).toBe(Math.round(val * 10000) / 10000);
    }
  });
});

// ---------------------------------------------------------------------------
// computeWeightedPowerScore
// ---------------------------------------------------------------------------
describe("computeWeightedPowerScore", () => {
  it("returns 0 for empty inputs", () => {
    expect(computeWeightedPowerScore([])).toBe(0);
  });

  it("returns the score for a single category", () => {
    const result = computeWeightedPowerScore([{ powerScore: 75, appCount: 100 }]);
    expect(result).toBe(75);
  });

  it("weights by appCount (larger category has more influence)", () => {
    const result = computeWeightedPowerScore([
      { powerScore: 100, appCount: 900 },
      { powerScore: 0, appCount: 100 },
    ]);
    // (100*900 + 0*100) / 1000 = 90
    expect(result).toBe(90);
  });

  it("equal-sized categories produce simple average", () => {
    const result = computeWeightedPowerScore([
      { powerScore: 80, appCount: 50 },
      { powerScore: 60, appCount: 50 },
    ]);
    expect(result).toBe(70);
  });

  it("treats appCount of 0 as 1 (floor)", () => {
    const result = computeWeightedPowerScore([
      { powerScore: 100, appCount: 0 },
    ]);
    expect(result).toBe(100);
  });

  it("rounds to nearest integer", () => {
    const result = computeWeightedPowerScore([
      { powerScore: 33, appCount: 1 },
      { powerScore: 67, appCount: 1 },
    ]);
    expect(result).toBe(50);
  });

  it("handles many categories", () => {
    const inputs = Array.from({ length: 10 }, (_, i) => ({
      powerScore: 50,
      appCount: 100,
    }));
    expect(computeWeightedPowerScore(inputs)).toBe(50);
  });

  it("negative appCount is treated as 1", () => {
    const result = computeWeightedPowerScore([
      { powerScore: 80, appCount: -5 },
    ]);
    expect(result).toBe(80);
  });
});
