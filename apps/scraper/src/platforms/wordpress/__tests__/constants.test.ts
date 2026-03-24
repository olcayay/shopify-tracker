import { describe, it, expect } from "vitest";
import { WORDPRESS_SEED_CATEGORIES, WORDPRESS_CONSTANTS, WORDPRESS_SCORING } from "../constants.js";

describe("WordPress constants", () => {
  describe("WORDPRESS_SEED_CATEGORIES", () => {
    it("has 43 seed categories (40 tags + 3 browse sections)", () => {
      expect(WORDPRESS_SEED_CATEGORIES.length).toBe(43);
    });

    it("includes key tags", () => {
      const cats = [...WORDPRESS_SEED_CATEGORIES];
      expect(cats.includes("contact-form")).toBeTruthy();
      expect(cats.includes("woocommerce")).toBeTruthy();
      expect(cats.includes("seo")).toBeTruthy();
      expect(cats.includes("security")).toBeTruthy();
      expect(cats.includes("page-builder")).toBeTruthy();
      expect(cats.includes("ai")).toBeTruthy();
      expect(cats.includes("cache")).toBeTruthy();
    });

    it("includes browse sections", () => {
      const cats = [...WORDPRESS_SEED_CATEGORIES];
      expect(cats.includes("_browse_popular")).toBeTruthy();
      expect(cats.includes("_browse_featured")).toBeTruthy();
      expect(cats.includes("_browse_blocks")).toBeTruthy();
    });
  });

  describe("WORDPRESS_CONSTANTS", () => {
    it("maxCategoryDepth is 0 (flat tags)", () => {
      expect(WORDPRESS_CONSTANTS.maxCategoryDepth).toBe(0);
    });

    it("defaultPagesPerCategory is 2", () => {
      expect(WORDPRESS_CONSTANTS.defaultPagesPerCategory).toBe(2);
    });

    it("has reasonable rate limits", () => {
      expect(WORDPRESS_CONSTANTS.rateLimit.minDelayMs >= 200).toBeTruthy();
      expect(WORDPRESS_CONSTANTS.rateLimit.maxDelayMs <= 5000).toBeTruthy();
      expect(WORDPRESS_CONSTANTS.rateLimit.minDelayMs < WORDPRESS_CONSTANTS.rateLimit.maxDelayMs).toBeTruthy();
    });

    it("tracks expected fields", () => {
      expect(WORDPRESS_CONSTANTS.trackedFields.includes("activeInstalls")).toBeTruthy();
      expect(WORDPRESS_CONSTANTS.trackedFields.includes("version")).toBeTruthy();
      expect(WORDPRESS_CONSTANTS.trackedFields.includes("tags")).toBeTruthy();
    });
  });

  describe("WORDPRESS_SCORING", () => {
    it("pageSize is 250", () => {
      expect(WORDPRESS_SCORING.pageSize).toBe(250);
    });

    it("pageDecay is 0.85", () => {
      expect(WORDPRESS_SCORING.pageDecay).toBe(0.85);
    });

    it("feature weight is 0 (no feature taxonomy)", () => {
      expect(WORDPRESS_SCORING.similarityWeights.feature).toBe(0.0);
    });

    it("weights sum to 1.0", () => {
      const w = WORDPRESS_SCORING.similarityWeights;
      const sum = w.category + w.feature + w.keyword + w.text;
      expect(Math.abs(sum - 1.0) < 0.001, `weights sum to ${sum}, expected 1.0`).toBeTruthy();
    });

    it("has stop words including WordPress-specific terms", () => {
      expect(WORDPRESS_SCORING.stopWords.has("wordpress")).toBeTruthy();
      expect(WORDPRESS_SCORING.stopWords.has("wp")).toBeTruthy();
      expect(WORDPRESS_SCORING.stopWords.has("plugin")).toBeTruthy();
    });
  });
});
