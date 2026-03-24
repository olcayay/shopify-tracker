import { describe, it, expect } from "vitest";
import { shopifyUrls } from "../urls.js";

describe("shopifyUrls", () => {
  describe("base", () => {
    it("has correct base URL", () => {
      expect(shopifyUrls.base).toBe("https://apps.shopify.com");
    });
  });

  describe("home", () => {
    it("returns the base URL", () => {
      expect(shopifyUrls.home()).toBe("https://apps.shopify.com");
    });
  });

  describe("app", () => {
    it("builds app detail URL from slug", () => {
      expect(shopifyUrls.app("omnisend")).toBe(
        "https://apps.shopify.com/omnisend",
      );
    });
  });

  describe("appReviews", () => {
    it("builds review URL with default page 1", () => {
      expect(shopifyUrls.appReviews("omnisend")).toBe(
        "https://apps.shopify.com/omnisend/reviews?sort_by=newest&page=1",
      );
    });

    it("builds review URL with custom page", () => {
      expect(shopifyUrls.appReviews("omnisend", 5)).toBe(
        "https://apps.shopify.com/omnisend/reviews?sort_by=newest&page=5",
      );
    });
  });

  describe("category", () => {
    it("builds category URL from slug", () => {
      expect(shopifyUrls.category("store-design")).toBe(
        "https://apps.shopify.com/categories/store-design",
      );
    });
  });

  describe("categoryPage", () => {
    it("builds category URL without page param for page 1", () => {
      expect(shopifyUrls.categoryPage("store-design")).toBe(
        "https://apps.shopify.com/categories/store-design",
      );
    });

    it("builds category URL without page param when page is 1", () => {
      expect(shopifyUrls.categoryPage("store-design", 1)).toBe(
        "https://apps.shopify.com/categories/store-design",
      );
    });

    it("builds category URL with page param for page > 1", () => {
      expect(shopifyUrls.categoryPage("store-design", 3)).toBe(
        "https://apps.shopify.com/categories/store-design?page=3",
      );
    });
  });

  describe("categoryAll", () => {
    it("builds category all URL without page param", () => {
      expect(shopifyUrls.categoryAll("marketing-and-conversion")).toBe(
        "https://apps.shopify.com/categories/marketing-and-conversion/all",
      );
    });

    it("builds category all URL with page param for page > 1", () => {
      expect(shopifyUrls.categoryAll("marketing-and-conversion", 2)).toBe(
        "https://apps.shopify.com/categories/marketing-and-conversion/all?page=2",
      );
    });
  });

  describe("search", () => {
    it("builds search URL with encoded keyword and default page", () => {
      expect(shopifyUrls.search("email marketing")).toBe(
        "https://apps.shopify.com/search?q=email%20marketing&st_source=autocomplete&page=1",
      );
    });

    it("builds search URL with custom page", () => {
      expect(shopifyUrls.search("seo", 3)).toBe(
        "https://apps.shopify.com/search?q=seo&st_source=autocomplete&page=3",
      );
    });

    it("encodes special characters in keyword", () => {
      expect(shopifyUrls.search("email & sms")).toBe(
        "https://apps.shopify.com/search?q=email%20%26%20sms&st_source=autocomplete&page=1",
      );
    });
  });

  describe("autocomplete", () => {
    it("builds autocomplete URL with encoded keyword", () => {
      expect(shopifyUrls.autocomplete("email")).toBe(
        "https://apps.shopify.com/search/autocomplete?q=email",
      );
    });

    it("encodes spaces in keyword", () => {
      expect(shopifyUrls.autocomplete("form builder")).toBe(
        "https://apps.shopify.com/search/autocomplete?q=form%20builder",
      );
    });
  });
});
