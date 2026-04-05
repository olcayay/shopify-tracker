import { describe, it, expect } from "vitest";
import { parseWooCommerceCategoryPage } from "../category-parser.js";
import { makeProduct, makeSearchResponse, makeEmptySearchResponse } from "./fixtures.js";

describe("parseWooCommerceCategoryPage", () => {
  it("parses full category page", () => {
    const products = [
      makeProduct({ slug: "app-1", title: "App 1", rating: 4.5, reviews_count: 10 }),
      makeProduct({ slug: "app-2", title: "App 2", rating: 3.8, reviews_count: 5 }),
    ];
    const json = makeSearchResponse(products, 120, 2);
    const result = parseWooCommerceCategoryPage(
      json, "merchandising",
      "https://woocommerce.com/wp-json/wccom-extensions/1.0/search?category=merchandising&per_page=60",
    );

    expect(result.slug).toBe("merchandising");
    expect(result.appCount).toBe(120);
    expect(result.apps).toHaveLength(2);
    expect(result.apps[0].slug).toBe("app-1");
    expect(result.apps[0].name).toBe("App 1");
    expect(result.apps[0].averageRating).toBe(4.5);
    expect(result.apps[0].position).toBe(1);
    expect(result.apps[1].position).toBe(2);
    expect(result.hasNextPage).toBe(true);
    expect(result.subcategoryLinks).toEqual([]);
  });

  it("parses empty category page", () => {
    const json = makeEmptySearchResponse();
    const result = parseWooCommerceCategoryPage(json, "empty-cat", "https://example.com");

    expect(result.apps).toEqual([]);
    expect(result.appCount).toBe(0);
    expect(result.hasNextPage).toBe(false);
  });

  it("calculates correct positions on page 2", () => {
    const products = [makeProduct({ slug: "page2-app" })];
    const json = makeSearchResponse(products, 100, 2);
    const result = parseWooCommerceCategoryPage(json, "cat", "https://example.com", 2);

    expect(result.apps[0].position).toBe(61); // (2-1)*60 + 1
  });

  it("hasNextPage is false on last page", () => {
    const products = [makeProduct()];
    const json = makeSearchResponse(products, 10, 1);
    const result = parseWooCommerceCategoryPage(json, "cat", "https://example.com", 1);

    expect(result.hasNextPage).toBe(false);
  });

  it("generates title from slug", () => {
    const json = makeEmptySearchResponse();
    const result = parseWooCommerceCategoryPage(json, "payment-gateways", "https://example.com");

    expect(result.title).toBe("Payment Gateways");
  });

  it("includes vendor info in extra field", () => {
    const products = [makeProduct({ vendor_name: "Stripe" })];
    const json = makeSearchResponse(products);
    const result = parseWooCommerceCategoryPage(json, "cat", "https://example.com");

    expect(result.apps[0].extra?.vendorName).toBe("Stripe");
  });
});
