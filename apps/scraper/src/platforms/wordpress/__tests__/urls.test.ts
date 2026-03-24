import { describe, it, expect } from "vitest";
import { wordpressUrls } from "../urls.js";

describe("wordpressUrls", () => {
  describe("plugin", () => {
    it("returns correct plugin page URL", () => {
      expect(wordpressUrls.plugin("akismet")).toBe("https://wordpress.org/plugins/akismet/",);
    });
  });

  describe("tag", () => {
    it("returns correct tag URL", () => {
      expect(wordpressUrls.tag("seo")).toBe("https://wordpress.org/plugins/tags/seo/",);
    });
  });

  describe("search", () => {
    it("encodes search keyword", () => {
      expect(wordpressUrls.search("contact form")).toBe("https://wordpress.org/plugins/search/contact%20form/",);
    });
  });

  describe("reviews", () => {
    it("returns page 1 reviews URL without page param", () => {
      expect(wordpressUrls.reviews("akismet")).toBe("https://wordpress.org/support/plugin/akismet/reviews/",);
    });

    it("returns page 1 reviews URL for page=1", () => {
      expect(wordpressUrls.reviews("akismet", 1)).toBe("https://wordpress.org/support/plugin/akismet/reviews/",);
    });

    it("returns paginated reviews URL for page > 1", () => {
      expect(wordpressUrls.reviews("akismet", 3)).toBe("https://wordpress.org/support/plugin/akismet/reviews/page/3/",);
    });
  });

  describe("apiSearch", () => {
    it("builds correct API search URL", () => {
      const url = wordpressUrls.apiSearch("forms", 1, 250);
      expect(url.startsWith("https://api.wordpress.org/plugins/info/1.2/")).toBeTruthy();
      expect(url.includes("action=query_plugins")).toBeTruthy();
      expect(url.includes("search=forms")).toBeTruthy();
      expect(url.includes("per_page=250")).toBeTruthy();
      expect(url.includes("page=1")).toBeTruthy();
    });

    it("encodes special characters in search term", () => {
      const url = wordpressUrls.apiSearch("contact form builder", 2, 50);
      expect(url.includes("search=contact%20form%20builder")).toBeTruthy();
      expect(url.includes("page=2")).toBeTruthy();
      expect(url.includes("per_page=50")).toBeTruthy();
    });

    it("uses defaults for page and perPage", () => {
      const url = wordpressUrls.apiSearch("seo");
      expect(url.includes("page=1")).toBeTruthy();
      expect(url.includes("per_page=250")).toBeTruthy();
    });
  });

  describe("apiTag", () => {
    it("builds correct API tag URL", () => {
      const url = wordpressUrls.apiTag("security", 1, 100);
      expect(url.includes("action=query_plugins")).toBeTruthy();
      expect(url.includes("tag=security")).toBeTruthy();
      expect(url.includes("per_page=100")).toBeTruthy();
    });
  });

  describe("apiBrowse", () => {
    it("builds correct API browse URL for popular", () => {
      const url = wordpressUrls.apiBrowse("popular");
      expect(url.includes("browse=popular")).toBeTruthy();
    });

    it("builds correct API browse URL for featured", () => {
      const url = wordpressUrls.apiBrowse("featured");
      expect(url.includes("browse=featured")).toBeTruthy();
    });
  });

  describe("apiPlugin", () => {
    it("builds correct API plugin info URL", () => {
      const url = wordpressUrls.apiPlugin("forminator");
      expect(url.startsWith("https://api.wordpress.org/plugins/info/1.2/")).toBeTruthy();
      expect(url.includes("action=plugin_information")).toBeTruthy();
      expect(url.includes("slug=forminator")).toBeTruthy();
    });
  });
});
