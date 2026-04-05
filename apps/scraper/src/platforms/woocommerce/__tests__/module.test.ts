import { describe, it, expect } from "vitest";
import { WooCommerceModule } from "../index.js";

describe("WooCommerceModule", () => {
  const mod = new WooCommerceModule();

  describe("platformId", () => {
    it("is 'woocommerce'", () => {
      expect(mod.platformId).toBe("woocommerce");
    });
  });

  describe("capabilities", () => {
    it("has keyword search", () => {
      expect(mod.capabilities.hasKeywordSearch).toBe(true);
    });

    it("has reviews (aggregate from search API)", () => {
      expect(mod.capabilities.hasReviews).toBe(true);
    });

    it("has featured sections", () => {
      expect(mod.capabilities.hasFeaturedSections).toBe(true);
    });

    it("has pricing", () => {
      expect(mod.capabilities.hasPricing).toBe(true);
    });

    it("has flat categories", () => {
      expect(mod.capabilities.hasFlatCategories).toBe(true);
    });

    it("does not have ad tracking", () => {
      expect(mod.capabilities.hasAdTracking).toBe(false);
    });

    it("does not have similar apps", () => {
      expect(mod.capabilities.hasSimilarApps).toBe(false);
    });

    it("does not have auto suggestions", () => {
      expect(mod.capabilities.hasAutoSuggestions).toBe(false);
    });

    it("does not have feature taxonomy", () => {
      expect(mod.capabilities.hasFeatureTaxonomy).toBe(false);
    });

    it("does not have launched date", () => {
      expect(mod.capabilities.hasLaunchedDate).toBe(false);
    });
  });

  describe("URL builders", () => {
    it("buildAppUrl returns correct URL", () => {
      expect(mod.buildAppUrl("woocommerce-subscriptions"))
        .toBe("https://woocommerce.com/products/woocommerce-subscriptions/");
    });

    it("buildCategoryUrl returns search API URL with category filter", () => {
      const url = mod.buildCategoryUrl("merchandising");
      expect(url).toContain("category=merchandising");
      expect(url).toContain("per_page=60");
    });

    it("buildSearchUrl returns search API URL with search filter", () => {
      const url = mod.buildSearchUrl("payment");
      expect(url).toContain("search=payment");
    });
  });

  describe("extractSlugFromUrl", () => {
    it("extracts slug from product URL", () => {
      expect(mod.extractSlugFromUrl("https://woocommerce.com/products/woocommerce-subscriptions/"))
        .toBe("woocommerce-subscriptions");
    });

    it("extracts slug from product URL without trailing slash", () => {
      expect(mod.extractSlugFromUrl("https://woocommerce.com/products/my-extension"))
        .toBe("my-extension");
    });

    it("extracts slug from URL with query params", () => {
      expect(mod.extractSlugFromUrl("https://woocommerce.com/products/my-app?ref=test"))
        .toBe("my-app");
    });

    it("falls back to last path segment for unknown URL format", () => {
      expect(mod.extractSlugFromUrl("https://example.com/some/path/app-name"))
        .toBe("app-name");
    });
  });

  describe("extractCategorySlugs", () => {
    it("extracts category slugs from platformData", () => {
      const slugs = mod.extractCategorySlugs({
        categories: [
          { slug: "merchandising", label: "Merchandising" },
          { slug: "payment-gateways", label: "Payment Gateways" },
        ],
      });
      expect(slugs).toEqual(["merchandising", "payment-gateways"]);
    });

    it("returns empty array when no categories", () => {
      expect(mod.extractCategorySlugs({})).toEqual([]);
    });

    it("returns empty array when categories is not an array", () => {
      expect(mod.extractCategorySlugs({ categories: "invalid" })).toEqual([]);
    });
  });

  describe("fetch methods require HttpClient", () => {
    it("fetchAppPage throws without HttpClient", async () => {
      await expect(mod.fetchAppPage("test"))
        .rejects.toThrow("HttpClient required");
    });

    it("fetchCategoryPage throws without HttpClient", async () => {
      await expect(mod.fetchCategoryPage("merchandising"))
        .rejects.toThrow("HttpClient required");
    });

    it("fetchSearchPage throws without HttpClient", async () => {
      await expect(mod.fetchSearchPage("payment"))
        .rejects.toThrow("HttpClient required");
    });
  });

  describe("fetchReviewPage returns empty", () => {
    it("returns empty reviews without needing HttpClient", async () => {
      const result = await mod.fetchReviewPage("test");
      const parsed = JSON.parse(result!);
      expect(parsed.reviews).toEqual([]);
    });
  });

  describe("parse methods", () => {
    it("parseAppDetails delegates to parser", () => {
      const json = JSON.stringify({ products: [] });
      const result = mod.parseAppDetails(json, "test-app");
      expect(result.slug).toBe("test-app");
    });

    it("parseCategoryPage delegates to parser", () => {
      const json = JSON.stringify({ products: [], total_products: 0, total_pages: 0 });
      const url = "https://woocommerce.com/wp-json/wccom-extensions/1.0/search?category=merchandising&per_page=60";
      const result = mod.parseCategoryPage(json, url);
      expect(result.slug).toBe("merchandising");
    });

    it("parseSearchPage delegates to parser", () => {
      const json = JSON.stringify({ products: [], total_products: 0, total_pages: 0 });
      const result = mod.parseSearchPage(json, "test", 1);
      expect(result.keyword).toBe("test");
      expect(result.currentPage).toBe(1);
    });

    it("parseReviewPage returns empty reviews", () => {
      const result = mod.parseReviewPage("{}", 1);
      expect(result.reviews).toEqual([]);
      expect(result.hasNextPage).toBe(false);
    });
  });
});
