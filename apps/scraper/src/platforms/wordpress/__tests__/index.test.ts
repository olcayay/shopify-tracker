import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WordPressModule } from "../index.js";

describe("WordPressModule", () => {
  const mod = new WordPressModule();

  describe("platformId", () => {
    it("returns 'wordpress'", () => {
      assert.equal(mod.platformId, "wordpress");
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

    it("has no auto suggestions", () => {
      assert.equal(mod.capabilities.hasAutoSuggestions, false);
    });

    it("has no feature taxonomy", () => {
      assert.equal(mod.capabilities.hasFeatureTaxonomy, false);
    });

    it("has no pricing", () => {
      assert.equal(mod.capabilities.hasPricing, false);
    });

    it("has launched date", () => {
      assert.equal(mod.capabilities.hasLaunchedDate, true);
    });
  });

  describe("constants", () => {
    it("has 43 seed categories (40 tags + 3 browse)", () => {
      assert.equal(mod.constants.seedCategories.length, 43);
    });

    it("seed categories include seo and security", () => {
      assert.ok(mod.constants.seedCategories.includes("seo"));
      assert.ok(mod.constants.seedCategories.includes("security"));
    });

    it("maxCategoryDepth is 0 (flat tags)", () => {
      assert.equal(mod.constants.maxCategoryDepth, 0);
    });

    it("defaultPagesPerCategory is 2", () => {
      assert.equal(mod.constants.defaultPagesPerCategory, 2);
    });
  });

  describe("scoringConfig", () => {
    it("pageSize is 250", () => {
      assert.equal(mod.scoringConfig.pageSize, 250);
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
        mod.buildAppUrl("contact-form-7"),
        "https://wordpress.org/plugins/contact-form-7/",
      );
    });

    it("buildCategoryUrl returns tag URL", () => {
      assert.equal(
        mod.buildCategoryUrl("seo"),
        "https://wordpress.org/plugins/tags/seo/",
      );
    });

    it("buildCategoryUrl returns browse URL for _browse_ slugs", () => {
      assert.equal(
        mod.buildCategoryUrl("_browse_popular"),
        "https://wordpress.org/plugins/browse/popular/",
      );
      assert.equal(
        mod.buildCategoryUrl("_browse_featured"),
        "https://wordpress.org/plugins/browse/featured/",
      );
    });

    it("buildSearchUrl encodes keyword", () => {
      assert.equal(
        mod.buildSearchUrl("contact form"),
        "https://wordpress.org/plugins/search/contact%20form/",
      );
    });

    it("buildReviewUrl returns reviews page URL", () => {
      assert.equal(
        mod.buildReviewUrl("forminator"),
        "https://wordpress.org/support/plugin/forminator/reviews/",
      );
    });

    it("buildReviewUrl with page number", () => {
      assert.equal(
        mod.buildReviewUrl("forminator", 3),
        "https://wordpress.org/support/plugin/forminator/reviews/page/3/",
      );
    });
  });

  describe("extractSlugFromUrl", () => {
    it("extracts slug from standard plugin URL", () => {
      assert.equal(
        mod.extractSlugFromUrl("https://wordpress.org/plugins/contact-form-7/"),
        "contact-form-7",
      );
    });

    it("extracts slug from URL with query params", () => {
      assert.equal(
        mod.extractSlugFromUrl("https://wordpress.org/plugins/akismet/?ref=search"),
        "akismet",
      );
    });

    it("falls back to last path segment for non-standard URLs", () => {
      assert.equal(
        mod.extractSlugFromUrl("https://example.com/some-path/my-plugin"),
        "my-plugin",
      );
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
      assert.deepEqual(slugs, ["contact-form", "email", "form"]);
    });

    it("returns empty array when no tags", () => {
      const slugs = mod.extractCategorySlugs({});
      assert.deepEqual(slugs, []);
    });

    it("returns empty array when tags is null", () => {
      const slugs = mod.extractCategorySlugs({ tags: null });
      assert.deepEqual(slugs, []);
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

      assert.equal(result.name, "Forminator \u2013 Contact Form");
      assert.equal(result.slug, "forminator");
      assert.equal(result.averageRating, 4.9);
      assert.equal(result.ratingCount, 5230);
      assert.equal(result.pricingHint, null);
      assert.equal(result.iconUrl, "https://example.com/icon-256.png");
      assert.equal(result.developer?.name, "WPMU DEV");
      assert.equal(result.developer?.url, "https://profiles.wordpress.org/wpmudev/");
      assert.deepEqual(result.badges, ["community"]);

      const pd = result.platformData;
      assert.equal(pd.shortDescription, "The easy-to-use WordPress form builder plugin.");
      assert.equal(pd.version, "1.30.0");
      assert.equal(pd.testedUpTo, "6.5");
      assert.equal(pd.requiresWP, "5.2");
      assert.equal(pd.requiresPHP, "7.4");
      assert.equal(pd.activeInstalls, 500000);
      assert.equal(pd.downloaded, 18000000);
      assert.equal(pd.added, "2018-04-01");
      assert.equal(pd.businessModel, "community");
    });

    it("handles missing optional fields gracefully", () => {
      const json = JSON.stringify({
        name: "Simple Plugin",
        slug: "simple-plugin",
        rating: 0,
        num_ratings: 0,
      });

      const result = mod.parseAppDetails(json, "simple-plugin");
      assert.equal(result.name, "Simple Plugin");
      assert.equal(result.slug, "simple-plugin");
      assert.equal(result.averageRating, 0);
      assert.equal(result.ratingCount, 0);
      assert.equal(result.iconUrl, null);
      assert.equal(result.developer, null);
      assert.deepEqual(result.badges, []);
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

      assert.equal(result.keyword, "test");
      assert.equal(result.totalResults, 1200);
      assert.equal(result.currentPage, 1);
      assert.equal(result.hasNextPage, true);
      assert.equal(result.apps.length, 2);

      assert.equal(result.apps[0].appSlug, "plugin-a");
      assert.equal(result.apps[0].appName, "Plugin A");
      assert.equal(result.apps[0].averageRating, 4.5);
      assert.equal(result.apps[0].position, 1);
      assert.equal(result.apps[0].isSponsored, false);
      assert.deepEqual(result.apps[0].badges, ["community"]);

      assert.equal(result.apps[1].appSlug, "plugin-b");
      assert.equal(result.apps[1].position, 2);
      assert.equal(result.apps[1].averageRating, 4);
    });

    it("sets hasNextPage false on last page", () => {
      const json = JSON.stringify({
        info: { page: 3, pages: 3, results: 50 },
        plugins: [],
      });

      const result = mod.parseSearchPage(json, "test", 3, 0);
      assert.equal(result.hasNextPage, false);
      assert.equal(result.currentPage, 3);
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

      assert.equal(result.slug, "contact-form");
      assert.equal(result.appCount, 300);
      assert.equal(result.hasNextPage, true);
      assert.equal(result.apps.length, 1);
      assert.equal(result.apps[0].slug, "contact-form-7");
      assert.equal(result.apps[0].name, "Contact Form 7");
      assert.equal(result.apps[0].averageRating, 4.3);
      assert.equal(result.apps[0].position, 1);
      assert.deepEqual(result.subcategoryLinks, []);
    });

    it("parses browse section URL and prefixes slug", () => {
      const json = JSON.stringify({
        info: { page: 1, pages: 1, results: 8 },
        plugins: [
          { name: "P1", slug: "p1", rating: 100, num_ratings: 10 },
        ],
      });

      const result = mod.parseCategoryPage(json, "https://wordpress.org/plugins/browse/featured/");
      assert.equal(result.slug, "_browse_featured");
      assert.equal(result.appCount, 8);
    });
  });
});
