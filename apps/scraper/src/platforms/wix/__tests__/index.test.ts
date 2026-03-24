import { describe, it, expect } from "vitest";
import { WixModule } from "../index.js";

describe("WixModule", () => {
  const mod = new WixModule();

  describe("platformId", () => {
    it("returns 'wix'", () => {
      expect(mod.platformId).toBe("wix");
    });
  });

  describe("capabilities", () => {
    it("has keyword search", () => {
      expect(mod.capabilities.hasKeywordSearch).toBe(true);
    });

    it("has reviews", () => {
      expect(mod.capabilities.hasReviews).toBe(true);
    });

    it("has featured sections", () => {
      expect(mod.capabilities.hasFeaturedSections).toBe(true);
    });

    it("has no ad tracking", () => {
      expect(mod.capabilities.hasAdTracking).toBe(false);
    });

    it("has no similar apps", () => {
      expect(mod.capabilities.hasSimilarApps).toBe(false);
    });

    it("has auto suggestions", () => {
      expect(mod.capabilities.hasAutoSuggestions).toBe(true);
    });

    it("has no feature taxonomy", () => {
      expect(mod.capabilities.hasFeatureTaxonomy).toBe(false);
    });

    it("has pricing", () => {
      expect(mod.capabilities.hasPricing).toBe(true);
    });

    it("has no launched date", () => {
      expect(mod.capabilities.hasLaunchedDate).toBe(false);
    });
  });

  describe("constants", () => {
    it("has 6 seed categories", () => {
      expect(mod.constants.seedCategories.length).toBe(6);
    });

    it("seed categories include marketing and communication", () => {
      expect(mod.constants.seedCategories.includes("marketing")).toBeTruthy();
      expect(mod.constants.seedCategories.includes("communication")).toBeTruthy();
    });

    it("maxCategoryDepth is 1", () => {
      expect(mod.constants.maxCategoryDepth).toBe(1);
    });

    it("defaultPagesPerCategory is 1", () => {
      expect(mod.constants.defaultPagesPerCategory).toBe(1);
    });
  });

  describe("scoringConfig", () => {
    it("pageSize is 50", () => {
      expect(mod.scoringConfig.pageSize).toBe(50);
    });

    it("feature weight is 0 (no feature taxonomy)", () => {
      expect(mod.scoringConfig.similarityWeights.feature).toBe(0.0);
    });

    it("weights sum to 1.0", () => {
      const w = mod.scoringConfig.similarityWeights;
      const sum = w.category + w.feature + w.keyword + w.text;
      expect(Math.abs(sum - 1.0) < 0.001, `weights sum to ${sum}, expected 1.0`).toBeTruthy();
    });
  });

  describe("URL builders", () => {
    it("buildAppUrl returns correct URL", () => {
      expect(mod.buildAppUrl("test-app")).toBe("https://www.wix.com/app-market/web-solution/test-app",);
    });

    it("buildCategoryUrl converts compound slug", () => {
      expect(mod.buildCategoryUrl("communication--forms")).toBe("https://www.wix.com/app-market/category/communication/forms",);
    });

    it("buildSearchUrl encodes keyword", () => {
      expect(mod.buildSearchUrl("form builder")).toBe("https://www.wix.com/app-market/search-result?query=form%20builder",);
    });

    it("buildReviewUrl returns app detail URL (reviews are embedded)", () => {
      expect(mod.buildReviewUrl("my-app")).toBe("https://www.wix.com/app-market/web-solution/my-app",);
    });

    it("buildAutoSuggestUrl returns autocomplete API URL", () => {
      const url = mod.buildAutoSuggestUrl("form");
      expect(url.includes("/_serverless/app-market-search/autocomplete")).toBeTruthy();
      expect(url.includes("term=form")).toBeTruthy();
      expect(url.includes("lang=en")).toBeTruthy();
    });
  });

  describe("extractSlugFromUrl", () => {
    it("extracts slug from standard app URL", () => {
      expect(mod.extractSlugFromUrl("https://www.wix.com/app-market/web-solution/123formbuilder")).toBe("123formbuilder",);
    });

    it("extracts slug from URL with query params", () => {
      expect(mod.extractSlugFromUrl("https://www.wix.com/app-market/web-solution/my-app?ref=search")).toBe("my-app",);
    });

    it("handles UUID-style slugs", () => {
      expect(mod.extractSlugFromUrl("https://www.wix.com/app-market/web-solution/e88d98fd-b485-4ed6-9f95-6d9bd0e79143")).toBe("e88d98fd-b485-4ed6-9f95-6d9bd0e79143",);
    });

    it("falls back to last path segment for non-standard URLs", () => {
      expect(mod.extractSlugFromUrl("https://example.com/some-path/app-slug")).toBe("app-slug",);
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
      expect(slugs).toEqual(["communication--forms", "marketing--email"]);
    });

    it("returns empty array when no categories", () => {
      const slugs = mod.extractCategorySlugs({});
      expect(slugs).toEqual([]);
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
      expect(slugs).toEqual(["forms", "seo"]);
    });
  });
});
