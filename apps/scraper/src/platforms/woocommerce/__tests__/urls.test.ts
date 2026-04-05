import { describe, it, expect } from "vitest";
import { woocommerceUrls } from "../urls.js";

describe("woocommerceUrls", () => {
  describe("base", () => {
    it("is the WooCommerce products root", () => {
      expect(woocommerceUrls.base).toBe("https://woocommerce.com/products");
    });
  });

  describe("app", () => {
    it("builds product detail URL", () => {
      expect(woocommerceUrls.app("woocommerce-subscriptions"))
        .toBe("https://woocommerce.com/products/woocommerce-subscriptions/");
    });
  });

  describe("category", () => {
    it("builds category URL without page", () => {
      expect(woocommerceUrls.category("merchandising"))
        .toBe("https://woocommerce.com/wp-json/wccom-extensions/1.0/search?category=merchandising&per_page=60");
    });

    it("builds category URL with page > 1", () => {
      const url = woocommerceUrls.category("merchandising", 3);
      expect(url).toContain("category=merchandising");
      expect(url).toContain("page=3");
      expect(url).toContain("per_page=60");
    });

    it("omits page param for page 1", () => {
      const url = woocommerceUrls.category("merchandising", 1);
      expect(url).not.toMatch(/[?&]page=\d/);
    });
  });

  describe("search", () => {
    it("builds search URL", () => {
      const url = woocommerceUrls.search("payment gateway");
      expect(url).toContain("search=payment+gateway");
      expect(url).toContain("per_page=60");
    });

    it("builds search URL with page", () => {
      const url = woocommerceUrls.search("subscriptions", 2);
      expect(url).toContain("search=subscriptions");
      expect(url).toContain("page=2");
    });
  });

  describe("all", () => {
    it("builds all extensions URL", () => {
      expect(woocommerceUrls.all())
        .toBe("https://woocommerce.com/wp-json/wccom-extensions/1.0/search?per_page=60");
    });

    it("adds page param", () => {
      expect(woocommerceUrls.all(2)).toContain("page=2");
    });
  });

  describe("categories", () => {
    it("returns categories endpoint", () => {
      expect(woocommerceUrls.categories())
        .toBe("https://woocommerce.com/wp-json/wccom-extensions/1.0/categories");
    });
  });

  describe("featured", () => {
    it("returns featured endpoint", () => {
      expect(woocommerceUrls.featured())
        .toBe("https://woocommerce.com/wp-json/wccom-extensions/1.0/featured");
    });
  });

  it("all URLs use woocommerce.com domain", () => {
    const urls = [
      woocommerceUrls.base,
      woocommerceUrls.app("test"),
      woocommerceUrls.category("test"),
      woocommerceUrls.search("test"),
      woocommerceUrls.all(),
      woocommerceUrls.categories(),
      woocommerceUrls.featured(),
    ];
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/woocommerce\.com\//);
    }
  });
});
