import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WixModule } from "../index.js";

describe("WixModule", () => {
  const mod = new WixModule();

  describe("platformId", () => {
    it("returns 'wix'", () => {
      assert.equal(mod.platformId, "wix");
    });
  });

  describe("capabilities", () => {
    it("has keyword search", () => {
      assert.equal(mod.capabilities.hasKeywordSearch, true);
    });

    it("has reviews", () => {
      assert.equal(mod.capabilities.hasReviews, true);
    });

    it("has featured sections", () => {
      assert.equal(mod.capabilities.hasFeaturedSections, true);
    });

    it("has no ad tracking", () => {
      assert.equal(mod.capabilities.hasAdTracking, false);
    });

    it("has no similar apps", () => {
      assert.equal(mod.capabilities.hasSimilarApps, false);
    });

    it("has auto suggestions", () => {
      assert.equal(mod.capabilities.hasAutoSuggestions, true);
    });

    it("has no feature taxonomy", () => {
      assert.equal(mod.capabilities.hasFeatureTaxonomy, false);
    });

    it("has pricing", () => {
      assert.equal(mod.capabilities.hasPricing, true);
    });

    it("has no launched date", () => {
      assert.equal(mod.capabilities.hasLaunchedDate, false);
    });
  });

  describe("constants", () => {
    it("has 6 seed categories", () => {
      assert.equal(mod.constants.seedCategories.length, 6);
    });

    it("seed categories include marketing and communication", () => {
      assert.ok(mod.constants.seedCategories.includes("marketing"));
      assert.ok(mod.constants.seedCategories.includes("communication"));
    });

    it("maxCategoryDepth is 1", () => {
      assert.equal(mod.constants.maxCategoryDepth, 1);
    });

    it("defaultPagesPerCategory is 1", () => {
      assert.equal(mod.constants.defaultPagesPerCategory, 1);
    });
  });

  describe("scoringConfig", () => {
    it("pageSize is 50", () => {
      assert.equal(mod.scoringConfig.pageSize, 50);
    });

    it("feature weight is 0 (no feature taxonomy)", () => {
      assert.equal(mod.scoringConfig.similarityWeights.feature, 0.0);
    });

    it("weights sum to 1.0", () => {
      const w = mod.scoringConfig.similarityWeights;
      const sum = w.category + w.feature + w.keyword + w.text;
      assert.ok(Math.abs(sum - 1.0) < 0.001, `weights sum to ${sum}, expected 1.0`);
    });
  });

  describe("URL builders", () => {
    it("buildAppUrl returns correct URL", () => {
      assert.equal(
        mod.buildAppUrl("test-app"),
        "https://www.wix.com/app-market/web-solution/test-app",
      );
    });

    it("buildCategoryUrl converts compound slug", () => {
      assert.equal(
        mod.buildCategoryUrl("communication--forms"),
        "https://www.wix.com/app-market/category/communication/forms",
      );
    });

    it("buildSearchUrl encodes keyword", () => {
      assert.equal(
        mod.buildSearchUrl("form builder"),
        "https://www.wix.com/app-market/search-result?query=form%20builder",
      );
    });

    it("buildReviewUrl returns app detail URL (reviews are embedded)", () => {
      assert.equal(
        mod.buildReviewUrl("my-app"),
        "https://www.wix.com/app-market/web-solution/my-app",
      );
    });

    it("buildAutoSuggestUrl returns autocomplete API URL", () => {
      const url = mod.buildAutoSuggestUrl("form");
      assert.ok(url.includes("/_serverless/app-market-search/autocomplete"));
      assert.ok(url.includes("term=form"));
      assert.ok(url.includes("lang=en"));
    });
  });

  describe("extractSlugFromUrl", () => {
    it("extracts slug from standard app URL", () => {
      assert.equal(
        mod.extractSlugFromUrl("https://www.wix.com/app-market/web-solution/123formbuilder"),
        "123formbuilder",
      );
    });

    it("extracts slug from URL with query params", () => {
      assert.equal(
        mod.extractSlugFromUrl("https://www.wix.com/app-market/web-solution/my-app?ref=search"),
        "my-app",
      );
    });

    it("handles UUID-style slugs", () => {
      assert.equal(
        mod.extractSlugFromUrl("https://www.wix.com/app-market/web-solution/e88d98fd-b485-4ed6-9f95-6d9bd0e79143"),
        "e88d98fd-b485-4ed6-9f95-6d9bd0e79143",
      );
    });

    it("falls back to last path segment for non-standard URLs", () => {
      assert.equal(
        mod.extractSlugFromUrl("https://example.com/some-path/app-slug"),
        "app-slug",
      );
    });
  });

  describe("extractCategorySlugs", () => {
    it("extracts category slugs from platformData", () => {
      const pd = {
        categories: [
          { slug: "communication--forms", parentSlug: "communication" },
          { slug: "marketing--email", parentSlug: "marketing" },
        ],
      };
      const slugs = mod.extractCategorySlugs(pd);
      assert.deepEqual(slugs, ["communication--forms", "marketing--email"]);
    });

    it("returns empty array when no categories", () => {
      const slugs = mod.extractCategorySlugs({});
      assert.deepEqual(slugs, []);
    });

    it("filters out empty slugs", () => {
      const pd = {
        categories: [
          { slug: "forms", parentSlug: "communication" },
          { slug: "", parentSlug: "marketing" },
          { slug: "seo", parentSlug: "marketing" },
        ],
      };
      const slugs = mod.extractCategorySlugs(pd);
      assert.deepEqual(slugs, ["forms", "seo"]);
    });
  });
});
