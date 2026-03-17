import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WORDPRESS_SEED_CATEGORIES, WORDPRESS_CONSTANTS, WORDPRESS_SCORING } from "../constants.js";

describe("WordPress constants", () => {
  describe("WORDPRESS_SEED_CATEGORIES", () => {
    it("has 43 seed categories (40 tags + 3 browse sections)", () => {
      assert.equal(WORDPRESS_SEED_CATEGORIES.length, 43);
    });

    it("includes key tags", () => {
      const cats = [...WORDPRESS_SEED_CATEGORIES];
      assert.ok(cats.includes("contact-form"));
      assert.ok(cats.includes("woocommerce"));
      assert.ok(cats.includes("seo"));
      assert.ok(cats.includes("security"));
      assert.ok(cats.includes("page-builder"));
      assert.ok(cats.includes("ai"));
      assert.ok(cats.includes("cache"));
    });

    it("includes browse sections", () => {
      const cats = [...WORDPRESS_SEED_CATEGORIES];
      assert.ok(cats.includes("_browse_popular"));
      assert.ok(cats.includes("_browse_featured"));
      assert.ok(cats.includes("_browse_blocks"));
    });
  });

  describe("WORDPRESS_CONSTANTS", () => {
    it("maxCategoryDepth is 0 (flat tags)", () => {
      assert.equal(WORDPRESS_CONSTANTS.maxCategoryDepth, 0);
    });

    it("defaultPagesPerCategory is 2", () => {
      assert.equal(WORDPRESS_CONSTANTS.defaultPagesPerCategory, 2);
    });

    it("has reasonable rate limits", () => {
      assert.ok(WORDPRESS_CONSTANTS.rateLimit.minDelayMs >= 200);
      assert.ok(WORDPRESS_CONSTANTS.rateLimit.maxDelayMs <= 5000);
      assert.ok(WORDPRESS_CONSTANTS.rateLimit.minDelayMs < WORDPRESS_CONSTANTS.rateLimit.maxDelayMs);
    });

    it("tracks expected fields", () => {
      assert.ok(WORDPRESS_CONSTANTS.trackedFields.includes("activeInstalls"));
      assert.ok(WORDPRESS_CONSTANTS.trackedFields.includes("version"));
      assert.ok(WORDPRESS_CONSTANTS.trackedFields.includes("tags"));
    });
  });

  describe("WORDPRESS_SCORING", () => {
    it("pageSize is 250", () => {
      assert.equal(WORDPRESS_SCORING.pageSize, 250);
    });

    it("pageDecay is 0.85", () => {
      assert.equal(WORDPRESS_SCORING.pageDecay, 0.85);
    });

    it("feature weight is 0 (no feature taxonomy)", () => {
      assert.equal(WORDPRESS_SCORING.similarityWeights.feature, 0.0);
    });

    it("weights sum to 1.0", () => {
      const w = WORDPRESS_SCORING.similarityWeights;
      const sum = w.category + w.feature + w.keyword + w.text;
      assert.ok(Math.abs(sum - 1.0) < 0.001, `weights sum to ${sum}, expected 1.0`);
    });

    it("has stop words including WordPress-specific terms", () => {
      assert.ok(WORDPRESS_SCORING.stopWords.has("wordpress"));
      assert.ok(WORDPRESS_SCORING.stopWords.has("wp"));
      assert.ok(WORDPRESS_SCORING.stopWords.has("plugin"));
    });
  });
});
