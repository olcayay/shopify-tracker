import { describe, it, expect } from "vitest";
import {
  WOOCOMMERCE_SEED_CATEGORIES,
  WOOCOMMERCE_FEATURED_SECTION_SLUGS,
  WOOCOMMERCE_CONSTANTS,
  WOOCOMMERCE_SCORING,
} from "../constants.js";

describe("WOOCOMMERCE_SEED_CATEGORIES", () => {
  it("has 8 real categories", () => {
    expect(WOOCOMMERCE_SEED_CATEGORIES).toHaveLength(8);
  });

  it("contains expected categories", () => {
    expect(WOOCOMMERCE_SEED_CATEGORIES).toContain("payment-gateways");
    expect(WOOCOMMERCE_SEED_CATEGORIES).toContain("merchandising");
    expect(WOOCOMMERCE_SEED_CATEGORIES).toContain("marketing-extensions");
    expect(WOOCOMMERCE_SEED_CATEGORIES).toContain("operations");
  });
});

describe("WOOCOMMERCE_FEATURED_SECTION_SLUGS", () => {
  it("has 3 featured/editorial slugs", () => {
    expect(WOOCOMMERCE_FEATURED_SECTION_SLUGS).toHaveLength(3);
  });

  it("contains editorial sections", () => {
    expect(WOOCOMMERCE_FEATURED_SECTION_SLUGS).toContain("_featured");
    expect(WOOCOMMERCE_FEATURED_SECTION_SLUGS).toContain("_all");
    expect(WOOCOMMERCE_FEATURED_SECTION_SLUGS).toContain("developed-by-woo");
  });
});

describe("WOOCOMMERCE_CONSTANTS", () => {
  it("has seedCategories matching WOOCOMMERCE_SEED_CATEGORIES", () => {
    expect(WOOCOMMERCE_CONSTANTS.seedCategories).toEqual([...WOOCOMMERCE_SEED_CATEGORIES]);
  });

  it("has featuredSectionSlugs matching WOOCOMMERCE_FEATURED_SECTION_SLUGS", () => {
    expect(WOOCOMMERCE_CONSTANTS.featuredSectionSlugs).toEqual([...WOOCOMMERCE_FEATURED_SECTION_SLUGS]);
  });

  it("has maxCategoryDepth of 0 (flat)", () => {
    expect(WOOCOMMERCE_CONSTANTS.maxCategoryDepth).toBe(0);
  });

  it("has rate limits defined", () => {
    expect(WOOCOMMERCE_CONSTANTS.rateLimit.minDelayMs).toBeGreaterThan(0);
    expect(WOOCOMMERCE_CONSTANTS.rateLimit.maxDelayMs).toBeGreaterThan(WOOCOMMERCE_CONSTANTS.rateLimit.minDelayMs);
  });

  it("has tracked fields defined", () => {
    expect(WOOCOMMERCE_CONSTANTS.trackedFields.length).toBeGreaterThan(0);
    expect(WOOCOMMERCE_CONSTANTS.trackedFields).toContain("shortDescription");
    expect(WOOCOMMERCE_CONSTANTS.trackedFields).toContain("pricing");
  });
});

describe("WOOCOMMERCE_SCORING", () => {
  it("has pageSize of 60", () => {
    expect(WOOCOMMERCE_SCORING.pageSize).toBe(60);
  });

  it("has pageDecay between 0 and 1", () => {
    expect(WOOCOMMERCE_SCORING.pageDecay).toBeGreaterThan(0);
    expect(WOOCOMMERCE_SCORING.pageDecay).toBeLessThan(1);
  });

  it("has similarity weights that sum to ~1.0", () => {
    const weights = WOOCOMMERCE_SCORING.similarityWeights;
    const sum = weights.category + weights.feature + weights.keyword + weights.text;
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it("has stop words set", () => {
    expect(WOOCOMMERCE_SCORING.stopWords.size).toBeGreaterThan(0);
    expect(WOOCOMMERCE_SCORING.stopWords.has("woocommerce")).toBe(true);
    expect(WOOCOMMERCE_SCORING.stopWords.has("wordpress")).toBe(true);
  });
});
