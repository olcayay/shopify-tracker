import { describe, it, expect } from "vitest";
import { HubSpotModule } from "../index.js";

describe("HubSpotModule", () => {
  const mod = new HubSpotModule();

  describe("platformId", () => {
    it("is 'hubspot'", () => {
      expect(mod.platformId).toBe("hubspot");
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

    it("has pricing", () => {
      expect(mod.capabilities.hasPricing).toBe(true);
    });

    it("does not have launched date", () => {
      expect(mod.capabilities.hasLaunchedDate).toBe(false);
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
  });

  describe("URL builders", () => {
    it("buildAppUrl returns correct URL", () => {
      expect(mod.buildAppUrl("mailchimp"))
        .toBe("https://ecosystem.hubspot.com/marketplace/listing/mailchimp");
    });

    it("buildCategoryUrl returns correct URL", () => {
      expect(mod.buildCategoryUrl("sales"))
        .toBe("https://ecosystem.hubspot.com/marketplace/apps/sales");
    });

    it("buildSearchUrl returns correct URL", () => {
      expect(mod.buildSearchUrl("email marketing"))
        .toBe("https://ecosystem.hubspot.com/marketplace/explore?query=email%20marketing");
    });

    it("buildReviewUrl returns app URL (reviews on same page)", () => {
      expect(mod.buildReviewUrl("mailchimp"))
        .toBe("https://ecosystem.hubspot.com/marketplace/listing/mailchimp");
    });
  });

  describe("extractSlugFromUrl", () => {
    it("extracts slug from standard listing URL", () => {
      expect(mod.extractSlugFromUrl("https://ecosystem.hubspot.com/marketplace/listing/mailchimp"))
        .toBe("mailchimp");
    });

    it("extracts slug from listing URL with query params", () => {
      expect(mod.extractSlugFromUrl("https://ecosystem.hubspot.com/marketplace/listing/my-app?ref=homepage"))
        .toBe("my-app");
    });

    it("extracts slug from listing URL with hash", () => {
      expect(mod.extractSlugFromUrl("https://ecosystem.hubspot.com/marketplace/listing/app-slug#reviews"))
        .toBe("app-slug");
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
          { slug: "sales", name: "Sales" },
          { slug: "marketing--email", name: "Email" },
        ],
      });
      expect(slugs).toEqual(["sales", "marketing--email"]);
    });

    it("returns empty array when no categories", () => {
      expect(mod.extractCategorySlugs({})).toEqual([]);
    });

    it("returns empty array when categories is not an array", () => {
      expect(mod.extractCategorySlugs({ categories: "invalid" })).toEqual([]);
    });

    it("filters out entries without slug", () => {
      const slugs = mod.extractCategorySlugs({
        categories: [
          { slug: "valid", name: "Valid" },
          { name: "No slug" },
          { slug: "", name: "Empty slug" },
        ],
      });
      expect(slugs).toEqual(["valid"]);
    });
  });

  describe("fetch methods require BrowserClient", () => {
    it("fetchAppPage throws without BrowserClient", async () => {
      await expect(mod.fetchAppPage("mailchimp"))
        .rejects.toThrow("BrowserClient required");
    });

    it("fetchCategoryPage throws without BrowserClient", async () => {
      await expect(mod.fetchCategoryPage("sales"))
        .rejects.toThrow("BrowserClient required");
    });

    it("fetchSearchPage throws without BrowserClient", async () => {
      await expect(mod.fetchSearchPage("email"))
        .rejects.toThrow("BrowserClient required");
    });

    it("fetchFeaturedSections throws without BrowserClient", async () => {
      await expect(mod.fetchFeaturedSections())
        .rejects.toThrow("BrowserClient required");
    });
  });

  describe("parse methods", () => {
    it("parseAppDetails delegates to parser", () => {
      const html = `<html><body><h1>Test App</h1></body></html>`;
      const result = mod.parseAppDetails(html, "test-app");
      expect(result.slug).toBe("test-app");
      expect(result.name).toBe("Test App");
    });

    it("parseCategoryPage delegates to parser", () => {
      const html = `<html><body><h1>Sales</h1></body></html>`;
      const url = "https://ecosystem.hubspot.com/marketplace/apps/sales";
      const result = mod.parseCategoryPage(html, url);
      expect(result.slug).toBe("sales");
    });

    it("parseSearchPage delegates to parser", () => {
      const html = `<html><body></body></html>`;
      const result = mod.parseSearchPage(html, "test", 1);
      expect(result.keyword).toBe("test");
      expect(result.currentPage).toBe(1);
    });

    it("parseReviewPage delegates to parser", () => {
      const html = `<html><body></body></html>`;
      const result = mod.parseReviewPage(html, 1);
      expect(result.reviews).toEqual([]);
      expect(result.hasNextPage).toBe(false);
    });
  });

  describe("parseCategoryPage slug extraction from URL", () => {
    it("extracts simple category slug", () => {
      const html = `<html><body><h1>Sales</h1></body></html>`;
      const result = mod.parseCategoryPage(html, "https://ecosystem.hubspot.com/marketplace/apps/sales");
      expect(result.slug).toBe("sales");
    });

    it("converts nested path to compound slug", () => {
      const html = `<html><body><h1>Email Marketing</h1></body></html>`;
      const result = mod.parseCategoryPage(html, "https://ecosystem.hubspot.com/marketplace/apps/marketing/email");
      expect(result.slug).toBe("marketing--email");
    });

    it("strips trailing slash from category URL", () => {
      const html = `<html><body><h1>Service</h1></body></html>`;
      const result = mod.parseCategoryPage(html, "https://ecosystem.hubspot.com/marketplace/apps/service/");
      expect(result.slug).toBe("service");
    });
  });
});
