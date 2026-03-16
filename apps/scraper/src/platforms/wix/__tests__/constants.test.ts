import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WIX_SEED_CATEGORIES, WIX_CONSTANTS, WIX_SCORING } from "../constants.js";

describe("WIX_SEED_CATEGORIES", () => {
  it("has exactly 6 L1 categories", () => {
    assert.equal(WIX_SEED_CATEGORIES.length, 6);
  });

  it("includes all expected L1 slugs", () => {
    const expected = ["marketing", "ecommerce", "booking--events", "media--content", "design-elements", "communication"];
    for (const slug of expected) {
      assert.ok(
        WIX_SEED_CATEGORIES.includes(slug as any),
        `Missing seed category: ${slug}`,
      );
    }
  });

  it("booking--events uses compound slug format", () => {
    assert.ok(WIX_SEED_CATEGORIES.includes("booking--events" as any));
  });

  it("media--content uses compound slug format", () => {
    assert.ok(WIX_SEED_CATEGORIES.includes("media--content" as any));
  });
});

describe("WIX_CONSTANTS", () => {
  it("seedCategories matches WIX_SEED_CATEGORIES", () => {
    assert.deepEqual(WIX_CONSTANTS.seedCategories, [...WIX_SEED_CATEGORIES]);
  });

  it("maxCategoryDepth is 1 (parent → subcategories only)", () => {
    assert.equal(WIX_CONSTANTS.maxCategoryDepth, 1);
  });

  it("defaultPagesPerCategory is 1 (all apps on one page)", () => {
    assert.equal(WIX_CONSTANTS.defaultPagesPerCategory, 1);
  });

  it("has rate limit configuration", () => {
    assert.ok(WIX_CONSTANTS.rateLimit);
    assert.equal(WIX_CONSTANTS.rateLimit!.minDelayMs, 1000);
    assert.equal(WIX_CONSTANTS.rateLimit!.maxDelayMs, 2000);
  });

  it("tracks expected fields", () => {
    const fields = WIX_CONSTANTS.trackedFields;
    assert.ok(fields.includes("tagline"));
    assert.ok(fields.includes("description"));
    assert.ok(fields.includes("pricingPlans"));
    assert.ok(fields.includes("languages"));
    assert.ok(fields.includes("collections"));
  });
});

describe("WIX_SCORING", () => {
  it("pageSize is 50", () => {
    assert.equal(WIX_SCORING.pageSize, 50);
  });

  it("pageDecay is 0.85", () => {
    assert.equal(WIX_SCORING.pageDecay, 0.85);
  });

  it("similarity weights sum to 1.0", () => {
    const w = WIX_SCORING.similarityWeights;
    const sum = w.category + w.feature + w.keyword + w.text;
    assert.ok(Math.abs(sum - 1.0) < 0.001, `weights sum to ${sum}`);
  });

  it("feature weight is 0 (no feature taxonomy)", () => {
    assert.equal(WIX_SCORING.similarityWeights.feature, 0.0);
  });

  it("stop words include platform-specific terms", () => {
    assert.ok(WIX_SCORING.stopWords.has("wix"));
    assert.ok(WIX_SCORING.stopWords.has("website"));
    assert.ok(WIX_SCORING.stopWords.has("web"));
  });

  it("stop words include common English terms", () => {
    assert.ok(WIX_SCORING.stopWords.has("the"));
    assert.ok(WIX_SCORING.stopWords.has("and"));
    assert.ok(WIX_SCORING.stopWords.has("for"));
  });
});
