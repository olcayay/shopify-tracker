import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { wixUrls } from "../urls.js";

describe("wixUrls", () => {
  describe("base", () => {
    it("has correct base URL", () => {
      assert.equal(wixUrls.base, "https://www.wix.com/app-market");
    });
  });

  describe("app", () => {
    it("builds app detail URL", () => {
      assert.equal(
        wixUrls.app("123formbuilder"),
        "https://www.wix.com/app-market/web-solution/123formbuilder",
      );
    });

    it("handles UUID-style slugs", () => {
      assert.equal(
        wixUrls.app("e88d98fd-b485-4ed6-9f95-6d9bd0e79143"),
        "https://www.wix.com/app-market/web-solution/e88d98fd-b485-4ed6-9f95-6d9bd0e79143",
      );
    });
  });

  describe("category", () => {
    it("builds simple category URL", () => {
      assert.equal(
        wixUrls.category("marketing"),
        "https://www.wix.com/app-market/category/marketing",
      );
    });

    it("converts compound slug (--) to / in URL", () => {
      assert.equal(
        wixUrls.category("communication--forms"),
        "https://www.wix.com/app-market/category/communication/forms",
      );
    });

    it("only converts first -- to / for triple-compound slugs", () => {
      assert.equal(
        wixUrls.category("ecommerce--shipping--delivery"),
        "https://www.wix.com/app-market/category/ecommerce/shipping--delivery",
      );
    });
  });

  describe("search", () => {
    it("builds search URL with encoded query", () => {
      assert.equal(
        wixUrls.search("form builder"),
        "https://www.wix.com/app-market/search-result?query=form%20builder",
      );
    });

    it("encodes special characters", () => {
      assert.equal(
        wixUrls.search("email & sms"),
        "https://www.wix.com/app-market/search-result?query=email%20%26%20sms",
      );
    });

    it("handles single word query", () => {
      assert.equal(
        wixUrls.search("form"),
        "https://www.wix.com/app-market/search-result?query=form",
      );
    });
  });

  describe("autocomplete", () => {
    it("builds autocomplete API URL with encoded term", () => {
      assert.equal(
        wixUrls.autocomplete("for"),
        "https://www.wix.com/_serverless/app-market-search/autocomplete?term=for&lang=en",
      );
    });

    it("encodes spaces in term", () => {
      assert.equal(
        wixUrls.autocomplete("form builder"),
        "https://www.wix.com/_serverless/app-market-search/autocomplete?term=form%20builder&lang=en",
      );
    });
  });
});
