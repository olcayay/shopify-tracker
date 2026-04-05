import { describe, it, expect } from "vitest";
import { parseWooCommerceSearchPage } from "../search-parser.js";
import { makeProduct, makeSearchResponse, makeEmptySearchResponse } from "./fixtures.js";

describe("parseWooCommerceSearchPage", () => {
  it("parses search results", () => {
    const products = [
      makeProduct({ slug: "stripe-payments", title: "Stripe Payments" }),
      makeProduct({ slug: "paypal-payments", title: "PayPal Payments" }),
    ];
    const json = makeSearchResponse(products, 50, 1);
    const result = parseWooCommerceSearchPage(json, "payment", 1);

    expect(result.keyword).toBe("payment");
    expect(result.totalResults).toBe(50);
    expect(result.apps).toHaveLength(2);
    expect(result.apps[0].appSlug).toBe("stripe-payments");
    expect(result.apps[0].appName).toBe("Stripe Payments");
    expect(result.apps[0].position).toBe(1);
    expect(result.apps[1].position).toBe(2);
    expect(result.currentPage).toBe(1);
    expect(result.hasNextPage).toBe(false);
  });

  it("returns empty for no results", () => {
    const json = makeEmptySearchResponse();
    const result = parseWooCommerceSearchPage(json, "nonexistent", 1);

    expect(result.apps).toEqual([]);
    expect(result.totalResults).toBe(0);
    expect(result.hasNextPage).toBe(false);
  });

  it("handles pagination", () => {
    const products = [makeProduct()];
    const json = makeSearchResponse(products, 200, 4);
    const result = parseWooCommerceSearchPage(json, "test", 2);

    expect(result.hasNextPage).toBe(true);
    expect(result.currentPage).toBe(2);
    expect(result.apps[0].position).toBe(61); // (2-1)*60 + 1
  });

  it("last page has no next page", () => {
    const products = [makeProduct()];
    const json = makeSearchResponse(products, 200, 4);
    const result = parseWooCommerceSearchPage(json, "test", 4);

    expect(result.hasNextPage).toBe(false);
  });
});
