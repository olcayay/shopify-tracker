import { describe, it, expect } from "vitest";
import {
  HUBSPOT_SEED_CATEGORIES,
  HUBSPOT_CATEGORY_NAMES,
  HUBSPOT_CONSTANTS,
  HUBSPOT_SCORING,
} from "../constants.js";

describe("HUBSPOT_SEED_CATEGORIES", () => {
  it("has 6 top-level categories", () => {
    expect(HUBSPOT_SEED_CATEGORIES).toHaveLength(6);
  });

  it("contains expected categories", () => {
    expect(HUBSPOT_SEED_CATEGORIES).toContain("sales");
    expect(HUBSPOT_SEED_CATEGORIES).toContain("marketing");
    expect(HUBSPOT_SEED_CATEGORIES).toContain("service");
    expect(HUBSPOT_SEED_CATEGORIES).toContain("commerce");
    expect(HUBSPOT_SEED_CATEGORIES).toContain("operations");
    expect(HUBSPOT_SEED_CATEGORIES).toContain("content");
  });
});

describe("HUBSPOT_CATEGORY_NAMES", () => {
  it("has a display name for each seed category", () => {
    for (const slug of HUBSPOT_SEED_CATEGORIES) {
      expect(HUBSPOT_CATEGORY_NAMES[slug]).toBeDefined();
      expect(HUBSPOT_CATEGORY_NAMES[slug].length).toBeGreaterThan(0);
    }
  });
});

describe("HUBSPOT_CONSTANTS", () => {
  it("has seedCategories matching HUBSPOT_SEED_CATEGORIES", () => {
    expect(HUBSPOT_CONSTANTS.seedCategories).toEqual([...HUBSPOT_SEED_CATEGORIES]);
  });

  it("has maxCategoryDepth of 1 (2-level hierarchy)", () => {
    expect(HUBSPOT_CONSTANTS.maxCategoryDepth).toBe(1);
  });

  it("has rate limits defined", () => {
    expect(HUBSPOT_CONSTANTS.rateLimit.minDelayMs).toBeGreaterThan(0);
    expect(HUBSPOT_CONSTANTS.rateLimit.maxDelayMs).toBeGreaterThan(HUBSPOT_CONSTANTS.rateLimit.minDelayMs);
  });

  it("has tracked fields defined", () => {
    expect(HUBSPOT_CONSTANTS.trackedFields.length).toBeGreaterThan(0);
    expect(HUBSPOT_CONSTANTS.trackedFields).toContain("shortDescription");
    expect(HUBSPOT_CONSTANTS.trackedFields).toContain("pricing");
  });
});

describe("HUBSPOT_SCORING", () => {
  it("has pageSize of 100", () => {
    expect(HUBSPOT_SCORING.pageSize).toBe(100);
  });

  it("has pageDecay between 0 and 1", () => {
    expect(HUBSPOT_SCORING.pageDecay).toBeGreaterThan(0);
    expect(HUBSPOT_SCORING.pageDecay).toBeLessThan(1);
  });

  it("has similarity weights that sum to ~1.0", () => {
    const weights = HUBSPOT_SCORING.similarityWeights;
    const sum = weights.category + weights.feature + weights.keyword + weights.text;
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it("has stop words set", () => {
    expect(HUBSPOT_SCORING.stopWords.size).toBeGreaterThan(0);
    expect(HUBSPOT_SCORING.stopWords.has("hubspot")).toBe(true);
    expect(HUBSPOT_SCORING.stopWords.has("crm")).toBe(true);
  });
});
