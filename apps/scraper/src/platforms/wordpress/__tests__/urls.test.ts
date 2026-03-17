import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { wordpressUrls } from "../urls.js";

describe("wordpressUrls", () => {
  describe("plugin", () => {
    it("returns correct plugin page URL", () => {
      assert.equal(
        wordpressUrls.plugin("akismet"),
        "https://wordpress.org/plugins/akismet/",
      );
    });
  });

  describe("tag", () => {
    it("returns correct tag URL", () => {
      assert.equal(
        wordpressUrls.tag("seo"),
        "https://wordpress.org/plugins/tags/seo/",
      );
    });
  });

  describe("search", () => {
    it("encodes search keyword", () => {
      assert.equal(
        wordpressUrls.search("contact form"),
        "https://wordpress.org/plugins/search/contact%20form/",
      );
    });
  });

  describe("reviews", () => {
    it("returns page 1 reviews URL without page param", () => {
      assert.equal(
        wordpressUrls.reviews("akismet"),
        "https://wordpress.org/support/plugin/akismet/reviews/",
      );
    });

    it("returns page 1 reviews URL for page=1", () => {
      assert.equal(
        wordpressUrls.reviews("akismet", 1),
        "https://wordpress.org/support/plugin/akismet/reviews/",
      );
    });

    it("returns paginated reviews URL for page > 1", () => {
      assert.equal(
        wordpressUrls.reviews("akismet", 3),
        "https://wordpress.org/support/plugin/akismet/reviews/page/3/",
      );
    });
  });

  describe("apiSearch", () => {
    it("builds correct API search URL", () => {
      const url = wordpressUrls.apiSearch("forms", 1, 250);
      assert.ok(url.startsWith("https://api.wordpress.org/plugins/info/1.2/"));
      assert.ok(url.includes("action=query_plugins"));
      assert.ok(url.includes("search=forms"));
      assert.ok(url.includes("per_page=250"));
      assert.ok(url.includes("page=1"));
    });

    it("encodes special characters in search term", () => {
      const url = wordpressUrls.apiSearch("contact form builder", 2, 50);
      assert.ok(url.includes("search=contact%20form%20builder"));
      assert.ok(url.includes("page=2"));
      assert.ok(url.includes("per_page=50"));
    });

    it("uses defaults for page and perPage", () => {
      const url = wordpressUrls.apiSearch("seo");
      assert.ok(url.includes("page=1"));
      assert.ok(url.includes("per_page=250"));
    });
  });

  describe("apiTag", () => {
    it("builds correct API tag URL", () => {
      const url = wordpressUrls.apiTag("security", 1, 100);
      assert.ok(url.includes("action=query_plugins"));
      assert.ok(url.includes("tag=security"));
      assert.ok(url.includes("per_page=100"));
    });
  });

  describe("apiBrowse", () => {
    it("builds correct API browse URL for popular", () => {
      const url = wordpressUrls.apiBrowse("popular");
      assert.ok(url.includes("browse=popular"));
    });

    it("builds correct API browse URL for featured", () => {
      const url = wordpressUrls.apiBrowse("featured");
      assert.ok(url.includes("browse=featured"));
    });
  });

  describe("apiPlugin", () => {
    it("builds correct API plugin info URL", () => {
      const url = wordpressUrls.apiPlugin("forminator");
      assert.ok(url.startsWith("https://api.wordpress.org/plugins/info/1.2/"));
      assert.ok(url.includes("action=plugin_information"));
      assert.ok(url.includes("slug=forminator"));
    });
  });
});
