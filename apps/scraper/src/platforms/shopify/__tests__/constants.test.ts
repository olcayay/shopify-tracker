import { describe, it, expect } from "vitest";
import { SHOPIFY_CONSTANTS, SHOPIFY_SCORING } from "../constants.js";

describe("SHOPIFY_CONSTANTS", () => {
  it("has exactly 6 seed categories", () => {
    expect(SHOPIFY_CONSTANTS.seedCategories).toHaveLength(6);
  });

  it("includes all expected seed category slugs", () => {
    const expected = [
      "finding-products",
      "selling-products",
      "orders-and-shipping",
      "store-design",
      "marketing-and-conversion",
      "store-management",
    ];
    for (const slug of expected) {
      expect(SHOPIFY_CONSTANTS.seedCategories).toContain(slug);
    }
  });

  it("maxCategoryDepth is 4", () => {
    expect(SHOPIFY_CONSTANTS.maxCategoryDepth).toBe(4);
  });

  it("defaultPagesPerCategory is 10", () => {
    expect(SHOPIFY_CONSTANTS.defaultPagesPerCategory).toBe(10);
  });

  it("has rate limit configuration", () => {
    expect(SHOPIFY_CONSTANTS.rateLimit).toBeDefined();
    expect(SHOPIFY_CONSTANTS.rateLimit!.minDelayMs).toBe(250);
    expect(SHOPIFY_CONSTANTS.rateLimit!.maxDelayMs).toBe(1500);
  });

  it("has concurrency settings", () => {
    expect(SHOPIFY_CONSTANTS.httpMaxConcurrency).toBe(6);
    expect(SHOPIFY_CONSTANTS.appDetailsConcurrency).toBe(8);
  });

  it("tracks expected fields", () => {
    const fields = SHOPIFY_CONSTANTS.trackedFields;
    expect(fields).toContain("appIntroduction");
    expect(fields).toContain("appDetails");
    expect(fields).toContain("seoTitle");
    expect(fields).toContain("features");
    expect(fields).toContain("pricing");
    expect(fields).toContain("averageRating");
    expect(fields).toContain("categories");
    expect(fields).toContain("pricingPlans");
    expect(fields).toContain("support");
  });
});

describe("SHOPIFY_SCORING", () => {
  it("pageSize is 24", () => {
    expect(SHOPIFY_SCORING.pageSize).toBe(24);
  });

  it("pageDecay is 0.85", () => {
    expect(SHOPIFY_SCORING.pageDecay).toBe(0.85);
  });

  it("similarity weights sum to 1.0", () => {
    const w = SHOPIFY_SCORING.similarityWeights;
    const sum = w.category + w.feature + w.keyword + w.text;
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });

  it("all similarity weights are equal at 0.25", () => {
    const w = SHOPIFY_SCORING.similarityWeights;
    expect(w.category).toBe(0.25);
    expect(w.feature).toBe(0.25);
    expect(w.keyword).toBe(0.25);
    expect(w.text).toBe(0.25);
  });

  it("stop words include platform-specific terms", () => {
    expect(SHOPIFY_SCORING.stopWords.has("shopify")).toBe(true);
    expect(SHOPIFY_SCORING.stopWords.has("store")).toBe(true);
    expect(SHOPIFY_SCORING.stopWords.has("shop")).toBe(true);
    expect(SHOPIFY_SCORING.stopWords.has("app")).toBe(true);
  });

  it("stop words include common English terms", () => {
    expect(SHOPIFY_SCORING.stopWords.has("the")).toBe(true);
    expect(SHOPIFY_SCORING.stopWords.has("and")).toBe(true);
    expect(SHOPIFY_SCORING.stopWords.has("for")).toBe(true);
    expect(SHOPIFY_SCORING.stopWords.has("with")).toBe(true);
  });
});
