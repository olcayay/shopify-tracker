import { describe, it, expect } from "vitest";
import { wixUrls } from "../urls.js";

describe("wixUrls", () => {
  describe("base", () => {
    it("has correct base URL", () => {
      expect(wixUrls.base).toBe("https://www.wix.com/app-market");
    });
  });

  describe("app", () => {
    it("builds app detail URL", () => {
      expect(wixUrls.app("123formbuilder")).toBe("https://www.wix.com/app-market/web-solution/123formbuilder",);
    });

    it("handles UUID-style slugs", () => {
      expect(wixUrls.app("e88d98fd-b485-4ed6-9f95-6d9bd0e79143")).toBe("https://www.wix.com/app-market/web-solution/e88d98fd-b485-4ed6-9f95-6d9bd0e79143",);
    });
  });

  describe("category", () => {
    it("builds simple category URL", () => {
      expect(wixUrls.category("marketing")).toBe("https://www.wix.com/app-market/category/marketing",);
    });

    it("converts compound slug (--) to / in URL", () => {
      expect(wixUrls.category("communication--forms")).toBe("https://www.wix.com/app-market/category/communication/forms",);
    });

    it("only converts first -- to / for triple-compound slugs", () => {
      expect(wixUrls.category("ecommerce--shipping--delivery")).toBe("https://www.wix.com/app-market/category/ecommerce/shipping--delivery",);
    });
  });

  describe("search", () => {
    it("builds search URL with encoded query", () => {
      expect(wixUrls.search("form builder")).toBe("https://www.wix.com/app-market/search-result?query=form%20builder",);
    });

    it("encodes special characters", () => {
      expect(wixUrls.search("email & sms")).toBe("https://www.wix.com/app-market/search-result?query=email%20%26%20sms",);
    });

    it("handles single word query", () => {
      expect(wixUrls.search("form")).toBe("https://www.wix.com/app-market/search-result?query=form",);
    });
  });

  describe("autocomplete", () => {
    it("builds autocomplete API URL with encoded term", () => {
      expect(wixUrls.autocomplete("for")).toBe("https://www.wix.com/_serverless/app-market-search/autocomplete?term=for&lang=en",);
    });

    it("encodes spaces in term", () => {
      expect(wixUrls.autocomplete("form builder")).toBe("https://www.wix.com/_serverless/app-market-search/autocomplete?term=form%20builder&lang=en",);
    });
  });
});
