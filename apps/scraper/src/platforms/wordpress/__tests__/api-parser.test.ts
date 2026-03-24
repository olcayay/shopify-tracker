import { describe, it, expect } from "vitest";
import { parsePluginInfo, parseSearchResults, parseTagResults } from "../parsers/api-parser.js";

describe("WordPress API Parser", () => {
  describe("parsePluginInfo", () => {
    it("parses a complete plugin response", () => {
      const data = {
        name: "Yoast SEO",
        slug: "wordpress-seo",
        rating: 96,
        num_ratings: 27500,
        icons: {
          "2x": "https://ps.w.org/wordpress-seo/assets/icon-256x256.png",
          "1x": "https://ps.w.org/wordpress-seo/assets/icon-128x128.png",
        },
        author: '<a href="https://yoast.com/">Team Yoast</a>',
        author_profile: "https://profiles.wordpress.org/joostdevalk/",
        business_model: "commercial",
        short_description: "The first true all-in-one SEO solution for WordPress.",
        version: "22.3",
        tested: "6.5",
        requires: "6.0",
        requires_php: "7.2",
        active_installs: 5000000,
        downloaded: 500000000,
        last_updated: "2024-03-20",
        added: "2010-09-01",
        contributors: { joostdevalk: {}, yoast: {} },
        tags: { seo: "seo", "xml-sitemap": "xml sitemap" },
        support_threads: 300,
        support_threads_resolved: 250,
        homepage: "https://yoast.com/wordpress/plugins/seo/",
        donate_link: "",
        sections: {
          description: "Full description of Yoast SEO",
          faq: "FAQ content",
          changelog: "Version 22.3 changes",
        },
        screenshots: { 1: { src: "screenshot-1.png", caption: "Dashboard" } },
        banners: { low: "https://ps.w.org/wordpress-seo/assets/banner-772x250.png" },
        ratings: { 5: 25000, 4: 1500, 3: 300, 2: 200, 1: 500 },
      };

      const result = parsePluginInfo(data);

      expect(result.name).toBe("Yoast SEO");
      expect(result.slug).toBe("wordpress-seo");
      expect(result.averageRating).toBe(4.8);
      expect(result.ratingCount).toBe(27500);
      expect(result.pricingHint).toBe(null);
      expect(result.iconUrl).toBe("https://ps.w.org/wordpress-seo/assets/icon-256x256.png");
      expect(result.developer?.name).toBe("Team Yoast");
      expect(result.developer?.url).toBe("https://profiles.wordpress.org/joostdevalk/");
      expect(result.badges).toEqual(["commercial"]);

      const pd = result.platformData;
      expect(pd.version).toBe("22.3");
      expect(pd.testedUpTo).toBe("6.5");
      expect(pd.requiresWP).toBe("6.0");
      expect(pd.requiresPHP).toBe("7.2");
      expect(pd.activeInstalls).toBe(5000000);
      expect(pd.downloaded).toBe(500000000);
      expect(pd.added).toBe("2010-09-01");
      expect(pd.businessModel).toBe("commercial");
      expect(pd.homepage).toBe("https://yoast.com/wordpress/plugins/seo/");
    });

    it("decodes HTML entities in name", () => {
      const data = {
        name: "Forminator &#8211; Contact Form, Payment Form &amp; Custom Form Builder",
        slug: "forminator",
        rating: 0,
        num_ratings: 0,
      };
      const result = parsePluginInfo(data);
      expect(result.name).toBe("Forminator \u2013 Contact Form, Payment Form & Custom Form Builder");
    });

    it("strips HTML from author field", () => {
      const data = {
        name: "Test",
        slug: "test",
        author: '<a href="https://example.com">Some <strong>Developer</strong></a>',
        author_profile: "https://profiles.wordpress.org/dev/",
        rating: 0,
        num_ratings: 0,
      };
      const result = parsePluginInfo(data);
      expect(result.developer?.name).toBe("Some Developer");
    });

    it("converts rating from 0-100 to 0-5 scale", () => {
      const data = { name: "T", slug: "t", rating: 80, num_ratings: 10 };
      const result = parsePluginInfo(data);
      expect(result.averageRating).toBe(4.0);
    });

    it("handles zero rating", () => {
      const data = { name: "T", slug: "t", rating: 0, num_ratings: 0 };
      const result = parsePluginInfo(data);
      expect(result.averageRating).toBe(0);
    });

    it("prefers 2x icon, falls back to 1x", () => {
      const with2x = parsePluginInfo({ name: "T", slug: "t", rating: 0, num_ratings: 0, icons: { "2x": "big.png", "1x": "small.png" } });
      expect(with2x.iconUrl).toBe("big.png");

      const only1x = parsePluginInfo({ name: "T", slug: "t", rating: 0, num_ratings: 0, icons: { "1x": "small.png" } });
      expect(only1x.iconUrl).toBe("small.png");

      const noIcons = parsePluginInfo({ name: "T", slug: "t", rating: 0, num_ratings: 0 });
      expect(noIcons.iconUrl).toBe(null);
    });

    it("handles missing author gracefully", () => {
      const data = { name: "T", slug: "t", rating: 0, num_ratings: 0 };
      const result = parsePluginInfo(data);
      expect(result.developer).toBe(null);
    });
  });

  describe("parseSearchResults", () => {
    it("parses a multi-plugin search response", () => {
      const data = {
        info: { page: 1, pages: 10, results: 2500, page_size: 250 },
        plugins: [
          { slug: "cf7", name: "Contact Form 7", short_description: "Best form plugin", rating: 86, num_ratings: 2000, icons: { "1x": "cf7.png" } },
          { slug: "wpf", name: "WPForms", short_description: "Drag and drop", rating: 98, num_ratings: 14000, icons: { "2x": "wpf.png" }, business_model: "commercial" },
        ],
      };

      const result = parseSearchResults(data, "contact form", 1);

      expect(result.keyword).toBe("contact form");
      expect(result.totalResults).toBe(2500);
      expect(result.currentPage).toBe(1);
      expect(result.hasNextPage).toBe(true);
      expect(result.apps.length).toBe(2);

      // First app
      expect(result.apps[0].position).toBe(1);
      expect(result.apps[0].appSlug).toBe("cf7");
      expect(result.apps[0].appName).toBe("Contact Form 7");
      expect(result.apps[0].averageRating).toBe(4.3);
      expect(result.apps[0].isSponsored).toBe(false);
      expect(result.apps[0].badges).toEqual([]);

      // Second app
      expect(result.apps[1].position).toBe(2);
      expect(result.apps[1].appSlug).toBe("wpf");
      expect(result.apps[1].badges).toEqual(["commercial"]);
    });

    it("handles last page correctly", () => {
      const data = {
        info: { page: 5, pages: 5, results: 120 },
        plugins: [],
      };

      const result = parseSearchResults(data, "test", 5);
      expect(result.hasNextPage).toBe(false);
      expect(result.currentPage).toBe(5);
    });

    it("handles page 2+ position offset", () => {
      const data = {
        info: { page: 2, pages: 3, results: 600, page_size: 250 },
        plugins: [
          { slug: "p1", name: "P1", short_description: "", rating: 0, num_ratings: 0, icons: {} },
        ],
      };

      const result = parseSearchResults(data, "test", 2);
      expect(result.apps[0].position).toBe(251);
    });

    it("handles empty plugins array", () => {
      const data = {
        info: { page: 1, pages: 0, results: 0 },
        plugins: [],
      };

      const result = parseSearchResults(data, "nonexistent", 1);
      expect(result.totalResults).toBe(0);
      expect(result.apps.length).toBe(0);
      expect(result.hasNextPage).toBe(false);
    });
  });

  describe("parseTagResults", () => {
    it("parses tag browse results", () => {
      const data = {
        info: { page: 1, pages: 3, results: 700 },
        plugins: [
          { slug: "yoast", name: "Yoast SEO", short_description: "SEO plugin", rating: 96, num_ratings: 27500, icons: { "2x": "yoast.png" } },
          { slug: "aioseo", name: "All in One SEO", short_description: "SEO toolkit", rating: 92, num_ratings: 8000, icons: { "1x": "aioseo.png" } },
        ],
      };

      const result = parseTagResults(data, "seo");

      expect(result.slug).toBe("seo");
      expect(result.url).toBe("https://wordpress.org/plugins/tags/seo/");
      expect(result.appCount).toBe(700);
      expect(result.hasNextPage).toBe(true);
      expect(result.subcategoryLinks).toEqual([]);
      expect(result.apps.length).toBe(2);

      expect(result.apps[0].slug).toBe("yoast");
      expect(result.apps[0].position).toBe(1);
      expect(result.apps[0].averageRating).toBe(4.8);

      expect(result.apps[1].slug).toBe("aioseo");
      expect(result.apps[1].position).toBe(2);
    });

    it("converts hyphenated slug to title", () => {
      const data = {
        info: { page: 1, pages: 1, results: 10 },
        plugins: [],
      };

      const result = parseTagResults(data, "contact-form");
      expect(result.title).toBe("contact form");
    });
  });
});
