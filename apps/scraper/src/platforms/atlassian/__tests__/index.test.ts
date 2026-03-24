import { describe, it, expect } from "vitest";
import { AtlassianModule } from "../index.js";

describe("AtlassianModule", () => {
  const mod = new AtlassianModule();

  describe("platformId", () => {
    it("returns 'atlassian'", () => {
      expect(mod.platformId).toBe("atlassian");
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

    it("has no auto suggestions", () => {
      expect(mod.capabilities.hasAutoSuggestions).toBe(false);
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
    it("has 10 seed categories", () => {
      expect(mod.constants.seedCategories).toHaveLength(10);
    });

    it("seed categories include project-management and admin-tools", () => {
      expect(mod.constants.seedCategories).toContain("project-management");
      expect(mod.constants.seedCategories).toContain("admin-tools");
    });

    it("maxCategoryDepth is 0 (flat categories)", () => {
      expect(mod.constants.maxCategoryDepth).toBe(0);
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
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
    });
  });

  describe("URL builders", () => {
    it("buildAppUrl returns correct URL for addon key", () => {
      expect(mod.buildAppUrl("com.example.addon")).toBe(
        "https://marketplace.atlassian.com/apps/com.example.addon",
      );
    });

    it("buildCategoryUrl returns correct category URL", () => {
      expect(mod.buildCategoryUrl("project-management")).toBe(
        "https://marketplace.atlassian.com/categories/project-management",
      );
    });

    it("buildSearchUrl returns correct search URL", () => {
      expect(mod.buildSearchUrl("time tracking")).toBe(
        "https://marketplace.atlassian.com/search?query=time%20tracking",
      );
    });

    it("buildReviewUrl returns API reviews URL", () => {
      const url = mod.buildReviewUrl("com.example.addon");
      expect(url).toContain("/rest/2/addons/com.example.addon/reviews");
    });
  });

  describe("extractSlugFromUrl", () => {
    it("extracts slug from standard app URL", () => {
      expect(
        mod.extractSlugFromUrl("https://marketplace.atlassian.com/apps/1234/my-addon"),
      ).toBe("my-addon");
    });

    it("extracts slug from app URL without numeric ID", () => {
      expect(
        mod.extractSlugFromUrl("https://marketplace.atlassian.com/apps/com.example.addon"),
      ).toBe("com.example.addon");
    });

    it("handles URL with query params", () => {
      expect(
        mod.extractSlugFromUrl("https://marketplace.atlassian.com/apps/my-addon?tab=overview"),
      ).toBe("my-addon");
    });
  });

  describe("extractCategorySlugs", () => {
    it("extracts category slugs from platformData", () => {
      const pd = {
        categories: [
          { slug: "project-management", name: "Project Management" },
          { slug: "admin-tools", name: "Admin Tools" },
        ],
      };
      expect(mod.extractCategorySlugs(pd)).toEqual(["project-management", "admin-tools"]);
    });

    it("returns empty array when no categories present", () => {
      expect(mod.extractCategorySlugs({})).toEqual([]);
    });

    it("uses key field as fallback for slug", () => {
      const pd = {
        categories: [
          { key: "data-analytics", name: "Data Analytics" },
        ],
      };
      expect(mod.extractCategorySlugs(pd)).toEqual(["data-analytics"]);
    });
  });
});
