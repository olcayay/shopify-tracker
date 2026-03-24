import { describe, it, expect } from "vitest";
import { WordPressModule } from "../index.js";

describe("WordPressModule", () => {
  const mod = new WordPressModule();

  describe("platformId", () => {
    it("returns 'wordpress'", () => {
      expect(mod.platformId).toBe("wordpress");
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

    it("has no pricing", () => {
      expect(mod.capabilities.hasPricing).toBe(false);
    });

    it("has launched date", () => {
      expect(mod.capabilities.hasLaunchedDate).toBe(true);
    });
  });

  describe("constants", () => {
    it("has 43 seed categories (40 tags + 3 browse)", () => {
      expect(mod.constants.seedCategories.length).toBe(43);
    });

    it("seed categories include seo and security", () => {
      expect(mod.constants.seedCategories.includes("seo")).toBeTruthy();
      expect(mod.constants.seedCategories.includes("security")).toBeTruthy();
    });

    it("maxCategoryDepth is 0 (flat tags)", () => {
      expect(mod.constants.maxCategoryDepth).toBe(0);
    });

    it("defaultPagesPerCategory is 2", () => {
      expect(mod.constants.defaultPagesPerCategory).toBe(2);
    });
  });

  describe("scoringConfig", () => {
    it("pageSize is 250", () => {
      expect(mod.scoringConfig.pageSize).toBe(250);
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
      expect(mod.buildAppUrl("contact-form-7")).toBe("https://wordpress.org/plugins/contact-form-7/",);
    });

    it("buildCategoryUrl returns tag URL", () => {
      expect(mod.buildCategoryUrl("seo")).toBe("https://wordpress.org/plugins/tags/seo/",);
    });

    it("buildCategoryUrl returns browse URL for _browse_ slugs", () => {
      expect(mod.buildCategoryUrl("_browse_popular")).toBe("https://wordpress.org/plugins/browse/popular/",);
      expect(mod.buildCategoryUrl("_browse_featured")).toBe("https://wordpress.org/plugins/browse/featured/",);
    });

    it("buildSearchUrl encodes keyword", () => {
      expect(mod.buildSearchUrl("contact form")).toBe("https://wordpress.org/plugins/search/contact%20form/",);
    });

    it("buildReviewUrl returns reviews page URL", () => {
      expect(mod.buildReviewUrl("forminator")).toBe("https://wordpress.org/support/plugin/forminator/reviews/",);
    });

    it("buildReviewUrl with page number", () => {
      expect(mod.buildReviewUrl("forminator", 3)).toBe("https://wordpress.org/support/plugin/forminator/reviews/page/3/",);
    });
  });

  describe("extractSlugFromUrl", () => {
    it("extracts slug from standard plugin URL", () => {
      expect(mod.extractSlugFromUrl("https://wordpress.org/plugins/contact-form-7/")).toBe("contact-form-7",);
    });

    it("extracts slug from URL with query params", () => {
      expect(mod.extractSlugFromUrl("https://wordpress.org/plugins/akismet/?ref=search")).toBe("akismet",);
    });

    it("falls back to last path segment for non-standard URLs", () => {
      expect(mod.extractSlugFromUrl("https://example.com/some-path/my-plugin")).toBe("my-plugin",);
    });
  });

  describe("extractCategorySlugs", () => {
    it("extracts tag keys from platformData", () => {
      const pd = {
        tags: {
          "contact-form": "contact form",
          "email": "email",
          "form": "form",
        },
      };
      const slugs = mod.extractCategorySlugs(pd);
      expect(slugs).toEqual(["contact-form", "email", "form"]);
    });

    it("returns empty array when no tags", () => {
      const slugs = mod.extractCategorySlugs({});
      expect(slugs).toEqual([]);
    });

    it("returns empty array when tags is null", () => {
      const slugs = mod.extractCategorySlugs({ tags: null });
      expect(slugs).toEqual([]);
    });
  });

  describe("parseAppDetails", () => {
    it("parses a full plugin info JSON", () => {
      const json = JSON.stringify({
        name: "Forminator &ndash; Contact Form",
        slug: "forminator",
        rating: 98,
        num_ratings: 5230,
        icons: { "2x": "https://example.com/icon-256.png", "1x": "https://example.com/icon-128.png" },
        author: '<a href="https://wpmudev.com/">WPMU DEV</a>',
        author_profile: "https://profiles.wordpress.org/wpmudev/",
        business_model: "community",
        short_description: "The easy-to-use WordPress form builder plugin.",
        version: "1.30.0",
        tested: "6.5",
        requires: "5.2",
        requires_php: "7.4",
        active_installs: 500000,
        downloaded: 18000000,
        last_updated: "2024-03-15",
        added: "2018-04-01",
        tags: { "contact-form": "contact form", "forms": "forms" },
        support_threads: 120,
        support_threads_resolved: 95,
        homepage: "https://wpmudev.com/forminator",
        sections: { description: "Full description here", faq: "FAQ here" },
        screenshots: {},
        banners: { low: "https://example.com/banner-772x250.png" },
        ratings: { 5: 4900, 4: 200, 3: 50, 2: 30, 1: 50 },
      });

      const result = mod.parseAppDetails(json, "forminator");

      expect(result.name).toBe("Forminator \u2013 Contact Form");
      expect(result.slug).toBe("forminator");
      expect(result.averageRating).toBe(4.9);
      expect(result.ratingCount).toBe(5230);
      expect(result.pricingHint).toBe(null);
      expect(result.iconUrl).toBe("https://example.com/icon-256.png");
      expect(result.developer?.name).toBe("WPMU DEV");
      expect(result.developer?.url).toBe("https://profiles.wordpress.org/wpmudev/");
      expect(result.badges).toEqual(["community"]);

      const pd = result.platformData;
      expect(pd.shortDescription).toBe("The easy-to-use WordPress form builder plugin.");
      expect(pd.version).toBe("1.30.0");
      expect(pd.testedUpTo).toBe("6.5");
      expect(pd.requiresWP).toBe("5.2");
      expect(pd.requiresPHP).toBe("7.4");
      expect(pd.activeInstalls).toBe(500000);
      expect(pd.downloaded).toBe(18000000);
      expect(pd.added).toBe("2018-04-01");
      expect(pd.businessModel).toBe("community");
    });

    it("handles missing optional fields gracefully", () => {
      const json = JSON.stringify({
        name: "Simple Plugin",
        slug: "simple-plugin",
        rating: 0,
        num_ratings: 0,
      });

      const result = mod.parseAppDetails(json, "simple-plugin");
      expect(result.name).toBe("Simple Plugin");
      expect(result.slug).toBe("simple-plugin");
      expect(result.averageRating).toBe(0);
      expect(result.ratingCount).toBe(0);
      expect(result.iconUrl).toBe(null);
      expect(result.developer).toBe(null);
      expect(result.badges).toEqual([]);
    });
  });

  describe("parseSearchPage", () => {
    it("parses search results JSON", () => {
      const json = JSON.stringify({
        info: { page: 1, pages: 5, results: 1200 },
        plugins: [
          {
            name: "Plugin A",
            slug: "plugin-a",
            short_description: "Desc A",
            rating: 90,
            num_ratings: 100,
            icons: { "1x": "https://example.com/a.png" },
            business_model: "community",
          },
          {
            name: "Plugin B",
            slug: "plugin-b",
            short_description: "Desc B",
            rating: 80,
            num_ratings: 50,
            icons: {},
          },
        ],
      });

      const result = mod.parseSearchPage(json, "test", 1, 0);

      expect(result.keyword).toBe("test");
      expect(result.totalResults).toBe(1200);
      expect(result.currentPage).toBe(1);
      expect(result.hasNextPage).toBe(true);
      expect(result.apps.length).toBe(2);

      expect(result.apps[0].appSlug).toBe("plugin-a");
      expect(result.apps[0].appName).toBe("Plugin A");
      expect(result.apps[0].averageRating).toBe(4.5);
      expect(result.apps[0].position).toBe(1);
      expect(result.apps[0].isSponsored).toBe(false);
      expect(result.apps[0].badges).toEqual(["community"]);

      expect(result.apps[1].appSlug).toBe("plugin-b");
      expect(result.apps[1].position).toBe(2);
      expect(result.apps[1].averageRating).toBe(4);
    });

    it("sets hasNextPage false on last page", () => {
      const json = JSON.stringify({
        info: { page: 3, pages: 3, results: 50 },
        plugins: [],
      });

      const result = mod.parseSearchPage(json, "test", 3, 0);
      expect(result.hasNextPage).toBe(false);
      expect(result.currentPage).toBe(3);
    });
  });

  describe("parseCategoryPage", () => {
    it("parses tag results JSON", () => {
      const json = JSON.stringify({
        info: { page: 1, pages: 2, results: 300 },
        plugins: [
          {
            name: "Contact Form 7",
            slug: "contact-form-7",
            short_description: "Just another contact form plugin.",
            rating: 86,
            num_ratings: 2000,
            icons: { "2x": "https://example.com/cf7.png" },
          },
        ],
      });

      const result = mod.parseCategoryPage(json, "https://wordpress.org/plugins/tags/contact-form/");

      expect(result.slug).toBe("contact-form");
      expect(result.appCount).toBe(300);
      expect(result.hasNextPage).toBe(true);
      expect(result.apps.length).toBe(1);
      expect(result.apps[0].slug).toBe("contact-form-7");
      expect(result.apps[0].name).toBe("Contact Form 7");
      expect(result.apps[0].averageRating).toBe(4.3);
      expect(result.apps[0].position).toBe(1);
      expect(result.subcategoryLinks).toEqual([]);
    });

    it("parses browse section URL and prefixes slug", () => {
      const json = JSON.stringify({
        info: { page: 1, pages: 1, results: 8 },
        plugins: [
          { name: "P1", slug: "p1", rating: 100, num_ratings: 10 },
        ],
      });

      const result = mod.parseCategoryPage(json, "https://wordpress.org/plugins/browse/featured/");
      expect(result.slug).toBe("_browse_featured");
      expect(result.appCount).toBe(8);
    });
  });
});
