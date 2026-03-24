import { describe, it, expect } from "vitest";
import { ZoomModule } from "../index.js";

describe("ZoomModule", () => {
  const mod = new ZoomModule();

  describe("platformId", () => {
    it("returns 'zoom'", () => {
      expect(mod.platformId).toBe("zoom");
    });
  });

  describe("capabilities", () => {
    it("has keyword search", () => {
      expect(mod.capabilities.hasKeywordSearch).toBe(true);
    });

    it("has featured sections", () => {
      expect(mod.capabilities.hasFeaturedSections).toBe(true);
    });

    it("has no reviews (requires auth)", () => {
      expect(mod.capabilities.hasReviews).toBe(false);
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

    it("has no pricing (requires auth)", () => {
      expect(mod.capabilities.hasPricing).toBe(false);
    });

    it("has no launched date", () => {
      expect(mod.capabilities.hasLaunchedDate).toBe(false);
    });
  });

  describe("URL builders", () => {
    it("buildAppUrl returns correct marketplace URL", () => {
      expect(mod.buildAppUrl("VG_p3Bb_TwWe_bgZmPUaXw")).toBe(
        "https://marketplace.zoom.us/apps/VG_p3Bb_TwWe_bgZmPUaXw",
      );
    });

    it("buildCategoryUrl returns correct category URL", () => {
      expect(mod.buildCategoryUrl("productivity")).toBe(
        "https://marketplace.zoom.us/apps?category=productivity",
      );
    });

    it("buildSearchUrl returns correct search URL with encoded keyword", () => {
      expect(mod.buildSearchUrl("project management")).toBe(
        "https://marketplace.zoom.us/apps?q=project%20management",
      );
    });
  });

  describe("extractSlugFromUrl", () => {
    it("extracts slug from standard app URL", () => {
      expect(
        mod.extractSlugFromUrl("https://marketplace.zoom.us/apps/VG_p3Bb_TwWe_bgZmPUaXw"),
      ).toBe("VG_p3Bb_TwWe_bgZmPUaXw");
    });

    it("extracts slug from URL with query params", () => {
      expect(
        mod.extractSlugFromUrl("https://marketplace.zoom.us/apps/ABC123?ref=search"),
      ).toBe("ABC123");
    });

    it("falls back to last path segment for non-standard URLs", () => {
      expect(
        mod.extractSlugFromUrl("https://example.com/some-path/my-app"),
      ).toBe("my-app");
    });
  });

  describe("extractCategorySlugs", () => {
    it("extracts category slugs from platformData", () => {
      const pd = {
        categories: [
          { slug: "productivity" },
          { slug: "project-management" },
        ],
      };
      expect(mod.extractCategorySlugs(pd)).toEqual([
        "productivity",
        "project-management",
      ]);
    });

    it("returns empty array when no categories", () => {
      expect(mod.extractCategorySlugs({})).toEqual([]);
    });

    it("returns empty array when categories is not an array", () => {
      expect(mod.extractCategorySlugs({ categories: "invalid" })).toEqual([]);
    });

    it("filters out entries without slug", () => {
      const pd = {
        categories: [
          { slug: "analytics" },
          { name: "No Slug" },
          { slug: "crm" },
        ],
      };
      expect(mod.extractCategorySlugs(pd)).toEqual(["analytics", "crm"]);
    });
  });
});
