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

    it("does not have reviews (not in CHIRP API)", () => {
      expect(mod.capabilities.hasReviews).toBe(false);
    });

    it("has featured sections", () => {
      expect(mod.capabilities.hasFeaturedSections).toBe(true);
    });

    it("has pricing", () => {
      expect(mod.capabilities.hasPricing).toBe(true);
    });

    it("has launched date (from firstPublishedAt)", () => {
      expect(mod.capabilities.hasLaunchedDate).toBe(true);
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
          { slug: "EMAIL", name: "Email" },
          { slug: "MARKETING_AUTOMATION", name: "Marketing Automation" },
        ],
      });
      expect(slugs).toEqual(["EMAIL", "MARKETING_AUTOMATION"]);
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

  describe("fetch methods require HttpClient", () => {
    it("fetchAppPage throws without HttpClient", async () => {
      await expect(mod.fetchAppPage("mailchimp"))
        .rejects.toThrow("HttpClient required");
    });

    it("fetchCategoryPage throws without HttpClient", async () => {
      await expect(mod.fetchCategoryPage("sales"))
        .rejects.toThrow("HttpClient required");
    });

    it("fetchSearchPage throws without HttpClient", async () => {
      await expect(mod.fetchSearchPage("email"))
        .rejects.toThrow("HttpClient required");
    });

    it("fetchFeaturedSections throws without HttpClient", async () => {
      await expect(mod.fetchFeaturedSections())
        .rejects.toThrow("HttpClient required");
    });
  });

  describe("fetchReviewPage returns empty JSON", () => {
    it("returns empty reviews JSON without any client", async () => {
      const result = await mod.fetchReviewPage("any-slug");
      expect(result).toBe(JSON.stringify({ reviews: [] }));
    });
  });

  describe("parse methods", () => {
    it("parseAppDetails delegates to parser", () => {
      const json = JSON.stringify({});
      const result = mod.parseAppDetails(json, "test-app");
      expect(result.slug).toBe("test-app");
      expect(result.name).toBe("test-app");
    });

    it("parseCategoryPage delegates to parser", () => {
      const json = JSON.stringify({ data: { total: 0, cards: [] } });
      const url = "https://ecosystem.hubspot.com/marketplace/apps/sales";
      const result = mod.parseCategoryPage(json, url);
      expect(result.slug).toBe("sales");
    });

    it("parseSearchPage delegates to parser", () => {
      const json = JSON.stringify({ data: { total: 0, cards: [] } });
      const result = mod.parseSearchPage(json, "test", 1);
      expect(result.keyword).toBe("test");
      expect(result.currentPage).toBe(1);
    });

    it("parseReviewPage delegates to parser", () => {
      const result = mod.parseReviewPage("{}", 1);
      expect(result.reviews).toEqual([]);
      expect(result.hasNextPage).toBe(false);
    });
  });

  describe("parseCategoryPage slug extraction from URL", () => {
    it("extracts simple category slug", () => {
      const json = JSON.stringify({ data: { total: 0, cards: [] } });
      const result = mod.parseCategoryPage(json, "https://ecosystem.hubspot.com/marketplace/apps/sales");
      expect(result.slug).toBe("sales");
    });

    it("converts nested path to compound slug", () => {
      const json = JSON.stringify({ data: { total: 0, cards: [] } });
      const result = mod.parseCategoryPage(json, "https://ecosystem.hubspot.com/marketplace/apps/marketing/email");
      expect(result.slug).toBe("marketing--email");
    });

    it("strips trailing slash from category URL", () => {
      const json = JSON.stringify({ data: { total: 0, cards: [] } });
      const result = mod.parseCategoryPage(json, "https://ecosystem.hubspot.com/marketplace/apps/service/");
      expect(result.slug).toBe("service");
    });
  });
});
