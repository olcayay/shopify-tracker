import { describe, it, expect } from "vitest";
import { WIX_SEED_CATEGORIES, WIX_CONSTANTS, WIX_SCORING } from "../constants.js";

describe("WIX_SEED_CATEGORIES", () => {
  it("has exactly 6 L1 categories", () => {
    expect(WIX_SEED_CATEGORIES.length).toBe(6);
  });

  it("includes all expected L1 slugs", () => {
    const expected = ["marketing", "ecommerce", "booking--events", "media--content", "design-elements", "communication"];
    for (const slug of expected) {
      expect(WIX_SEED_CATEGORIES.includes(slug as any),
        `Missing seed category: ${slug}`,).toBeTruthy();
    }
  });

  it("booking--events uses compound slug format", () => {
    expect(WIX_SEED_CATEGORIES.includes("booking--events" as any)).toBeTruthy();
  });

  it("media--content uses compound slug format", () => {
    expect(WIX_SEED_CATEGORIES.includes("media--content" as any)).toBeTruthy();
  });
});

describe("WIX_CONSTANTS", () => {
  it("seedCategories matches WIX_SEED_CATEGORIES", () => {
    expect(WIX_CONSTANTS.seedCategories).toEqual([...WIX_SEED_CATEGORIES]);
  });

  it("maxCategoryDepth is 1 (parent → subcategories only)", () => {
    expect(WIX_CONSTANTS.maxCategoryDepth).toBe(1);
  });

  it("defaultPagesPerCategory is 1 (all apps on one page)", () => {
    expect(WIX_CONSTANTS.defaultPagesPerCategory).toBe(1);
  });

  it("has rate limit configuration", () => {
    expect(WIX_CONSTANTS.rateLimit).toBeTruthy();
    expect(WIX_CONSTANTS.rateLimit!.minDelayMs).toBe(1000);
    expect(WIX_CONSTANTS.rateLimit!.maxDelayMs).toBe(2000);
  });

  it("tracks expected fields", () => {
    const fields = WIX_CONSTANTS.trackedFields;
    expect(fields.includes("tagline")).toBeTruthy();
    expect(fields.includes("description")).toBeTruthy();
    expect(fields.includes("pricingPlans")).toBeTruthy();
    expect(fields.includes("languages")).toBeTruthy();
    expect(fields.includes("collections")).toBeTruthy();
  });
});

describe("WIX_SCORING", () => {
  it("pageSize is 50", () => {
    expect(WIX_SCORING.pageSize).toBe(50);
  });

  it("pageDecay is 0.85", () => {
    expect(WIX_SCORING.pageDecay).toBe(0.85);
  });

  it("similarity weights sum to 1.0", () => {
    const w = WIX_SCORING.similarityWeights;
    const sum = w.category + w.feature + w.keyword + w.text;
    expect(Math.abs(sum - 1.0) < 0.001, `weights sum to ${sum}`).toBeTruthy();
  });

  it("feature weight is 0 (no feature taxonomy)", () => {
    expect(WIX_SCORING.similarityWeights.feature).toBe(0.0);
  });

  it("stop words include platform-specific terms", () => {
    expect(WIX_SCORING.stopWords.has("wix")).toBeTruthy();
    expect(WIX_SCORING.stopWords.has("website")).toBeTruthy();
    expect(WIX_SCORING.stopWords.has("web")).toBeTruthy();
  });

  it("stop words include common English terms", () => {
    expect(WIX_SCORING.stopWords.has("the")).toBeTruthy();
    expect(WIX_SCORING.stopWords.has("and")).toBeTruthy();
    expect(WIX_SCORING.stopWords.has("for")).toBeTruthy();
  });
});
