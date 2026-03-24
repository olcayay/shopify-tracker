import { describe, it, expect } from "vitest";
import { ShopifyModule } from "../index.js";

describe("ShopifyModule", () => {
  const mod = new ShopifyModule();

  describe("platformId", () => {
    it("returns 'shopify'", () => {
      expect(mod.platformId).toBe("shopify");
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

    it("has ad tracking", () => {
      expect(mod.capabilities.hasAdTracking).toBe(true);
    });

    it("has similar apps", () => {
      expect(mod.capabilities.hasSimilarApps).toBe(true);
    });

    it("has auto suggestions", () => {
      expect(mod.capabilities.hasAutoSuggestions).toBe(true);
    });

    it("has feature taxonomy", () => {
      expect(mod.capabilities.hasFeatureTaxonomy).toBe(true);
    });

    it("has pricing", () => {
      expect(mod.capabilities.hasPricing).toBe(true);
    });

    it("has launched date", () => {
      expect(mod.capabilities.hasLaunchedDate).toBe(true);
    });
  });

  describe("URL builders", () => {
    it("buildAppUrl returns correct URL", () => {
      expect(mod.buildAppUrl("omnisend")).toBe(
        "https://apps.shopify.com/omnisend",
      );
    });

    it("buildCategoryUrl returns correct URL without page", () => {
      expect(mod.buildCategoryUrl("store-design")).toBe(
        "https://apps.shopify.com/categories/store-design",
      );
    });

    it("buildCategoryUrl includes page parameter for page > 1", () => {
      expect(mod.buildCategoryUrl("store-design", 3)).toBe(
        "https://apps.shopify.com/categories/store-design?page=3",
      );
    });

    it("buildSearchUrl returns correct URL with encoded keyword", () => {
      expect(mod.buildSearchUrl("email marketing", 1)).toBe(
        "https://apps.shopify.com/search?q=email%20marketing&st_source=autocomplete&page=1",
      );
    });

    it("buildReviewUrl returns correct URL", () => {
      expect(mod.buildReviewUrl("omnisend", 2)).toBe(
        "https://apps.shopify.com/omnisend/reviews?sort_by=newest&page=2",
      );
    });

    it("buildAutoSuggestUrl returns autocomplete URL", () => {
      expect(mod.buildAutoSuggestUrl("email")).toBe(
        "https://apps.shopify.com/search/autocomplete?q=email",
      );
    });
  });

  describe("extractSlugFromUrl", () => {
    it("extracts slug from standard app URL", () => {
      expect(
        mod.extractSlugFromUrl("https://apps.shopify.com/omnisend"),
      ).toBe("omnisend");
    });

    it("extracts slug from URL with query params", () => {
      expect(
        mod.extractSlugFromUrl("https://apps.shopify.com/omnisend?ref=search"),
      ).toBe("omnisend");
    });

    it("extracts slug from URL with trailing path segments", () => {
      expect(
        mod.extractSlugFromUrl("https://apps.shopify.com/omnisend/reviews"),
      ).toBe("omnisend");
    });
  });

  describe("extractCategorySlugs", () => {
    it("extracts category slugs from platformData", () => {
      const pd = {
        categories: [
          { url: "https://apps.shopify.com/categories/marketing-and-conversion" },
          { url: "https://apps.shopify.com/categories/store-management" },
        ],
      };
      expect(mod.extractCategorySlugs(pd)).toEqual([
        "marketing-and-conversion",
        "store-management",
      ]);
    });

    it("returns empty array when no categories", () => {
      expect(mod.extractCategorySlugs({})).toEqual([]);
    });

    it("filters out categories without matching URL pattern", () => {
      const pd = {
        categories: [
          { url: "https://apps.shopify.com/categories/store-design" },
          { url: "https://example.com/no-match" },
        ],
      };
      expect(mod.extractCategorySlugs(pd)).toEqual(["store-design"]);
    });
  });

  describe("extractFeatureHandles", () => {
    it("extracts feature handles from nested categories", () => {
      const pd = {
        categories: [
          {
            subcategories: [
              {
                features: [
                  { feature_handle: "email-marketing" },
                  { feature_handle: "sms-marketing" },
                ],
              },
            ],
          },
          {
            subcategories: [
              {
                features: [
                  { feature_handle: "seo-optimization" },
                ],
              },
            ],
          },
        ],
      };
      expect(mod.extractFeatureHandles(pd)).toEqual([
        "email-marketing",
        "sms-marketing",
        "seo-optimization",
      ]);
    });

    it("returns empty array when no categories", () => {
      expect(mod.extractFeatureHandles({})).toEqual([]);
    });

    it("returns empty array when subcategories have no features", () => {
      const pd = {
        categories: [
          { subcategories: [{}] },
        ],
      };
      expect(mod.extractFeatureHandles(pd)).toEqual([]);
    });

    it("returns empty array when categories have no subcategories", () => {
      const pd = {
        categories: [{ url: "https://example.com" }],
      };
      expect(mod.extractFeatureHandles(pd)).toEqual([]);
    });
  });
});
