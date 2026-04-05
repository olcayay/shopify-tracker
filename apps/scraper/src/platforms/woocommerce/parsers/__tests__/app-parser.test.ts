import { describe, it, expect } from "vitest";
import { parseWooCommerceAppDetails } from "../app-parser.js";
import { makeProduct, makeSearchResponse } from "./fixtures.js";

describe("parseWooCommerceAppDetails", () => {
  it("parses a full product from search response", () => {
    const product = makeProduct({
      title: "WooCommerce Subscriptions",
      slug: "woocommerce-subscriptions",
      raw_price: 279,
      rating: 4.2,
      reviews_count: 150,
      vendor_name: "Woo",
    });
    const json = makeSearchResponse([product]);
    const result = parseWooCommerceAppDetails(json, "woocommerce-subscriptions");

    expect(result.name).toBe("WooCommerce Subscriptions");
    expect(result.slug).toBe("woocommerce-subscriptions");
    expect(result.averageRating).toBe(4.2);
    expect(result.ratingCount).toBe(150);
    expect(result.pricingHint).toBe("$279/year");
    expect(result.developer?.name).toBe("Woo");
    expect(result.badges).toContain("developed_by_woo");
  });

  it("parses free extension", () => {
    const product = makeProduct({ raw_price: 0, slug: "free-ext" });
    const json = makeSearchResponse([product]);
    const result = parseWooCommerceAppDetails(json, "free-ext");

    expect(result.pricingHint).toBe("Free");
  });

  it("handles missing rating", () => {
    const product = makeProduct({ rating: null, reviews_count: null });
    const json = makeSearchResponse([product]);
    const result = parseWooCommerceAppDetails(json, "test-extension");

    expect(result.averageRating).toBeNull();
    expect(result.ratingCount).toBeNull();
  });

  it("handles on sale badge", () => {
    const product = makeProduct({ is_on_sale: true });
    const json = makeSearchResponse([product]);
    const result = parseWooCommerceAppDetails(json, "test-extension");

    expect(result.badges).toContain("on_sale");
  });

  it("handles freemium badge", () => {
    const product = makeProduct({ freemium_type: "freemium" });
    const json = makeSearchResponse([product]);
    const result = parseWooCommerceAppDetails(json, "test-extension");

    expect(result.badges).toContain("freemium");
  });

  it("handles missing vendor", () => {
    const product = makeProduct({ vendor_name: "" });
    const json = makeSearchResponse([product]);
    const result = parseWooCommerceAppDetails(json, "test-extension");

    expect(result.developer).toBeNull();
  });

  it("handles empty response gracefully", () => {
    const json = makeSearchResponse([]);
    const result = parseWooCommerceAppDetails(json, "missing-app");

    expect(result.slug).toBe("missing-app");
    expect(result.name).toBe("missing-app");
  });

  it("finds product by slug from multiple results", () => {
    const products = [
      makeProduct({ slug: "other-app", title: "Other App" }),
      makeProduct({ slug: "target-app", title: "Target App" }),
    ];
    const json = makeSearchResponse(products);
    const result = parseWooCommerceAppDetails(json, "target-app");

    expect(result.name).toBe("Target App");
    expect(result.slug).toBe("target-app");
  });

  it("populates platformData with WooCommerce-specific fields", () => {
    const product = makeProduct({
      hash: "abc123",
      type: "extension",
      is_installable: true,
      billing_period: "year",
    });
    const json = makeSearchResponse([product]);
    const result = parseWooCommerceAppDetails(json, "test-extension");

    expect(result.platformData.hash).toBe("abc123");
    expect(result.platformData.type).toBe("extension");
    expect(result.platformData.isInstallable).toBe(true);
    expect(result.platformData.source).toBe("woocommerce-api");
  });

  it("includes billing period in pricing hint", () => {
    const product = makeProduct({ raw_price: 49, billing_period: "month" });
    const json = makeSearchResponse([product]);
    const result = parseWooCommerceAppDetails(json, "test-extension");

    expect(result.pricingHint).toBe("$49/month");
  });
});
