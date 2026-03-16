import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseWixSearchPage } from "../search-parser.js";
import { buildSearchHtml, buildWixHtml } from "./fixtures.js";

describe("parseWixSearchPage", () => {
  it("parses search results with app details", () => {
    const html = buildSearchHtml({
      apps: [
        { slug: "form-builder", name: "Form Builder", rating: 4.5, reviewCount: 1000, pricingType: "FREE_PLAN_AVAILABLE" },
        { slug: "jotform", name: "JotForm", rating: 4.3, reviewCount: 500, pricingType: "FREE" },
      ],
      total: 48,
    });
    const result = parseWixSearchPage(html, "form", 1, 0);
    assert.equal(result.keyword, "form");
    assert.equal(result.totalResults, 48);
    assert.equal(result.apps.length, 2);
    assert.equal(result.currentPage, 1);
  });

  it("assigns sequential positions starting from offset + 1", () => {
    const html = buildSearchHtml({
      apps: [
        { slug: "app-1", name: "App 1" },
        { slug: "app-2", name: "App 2" },
        { slug: "app-3", name: "App 3" },
      ],
    });
    const result = parseWixSearchPage(html, "test", 1, 0);
    assert.equal(result.apps[0].position, 1);
    assert.equal(result.apps[1].position, 2);
    assert.equal(result.apps[2].position, 3);
  });

  it("applies offset to positions", () => {
    const html = buildSearchHtml({
      apps: [
        { slug: "app-1", name: "App 1" },
        { slug: "app-2", name: "App 2" },
      ],
    });
    const result = parseWixSearchPage(html, "test", 2, 50);
    assert.equal(result.apps[0].position, 51);
    assert.equal(result.apps[1].position, 52);
    assert.equal(result.currentPage, 2);
  });

  it("parses app slug and name", () => {
    const html = buildSearchHtml({
      apps: [{ slug: "my-great-app", name: "My Great App" }],
    });
    const result = parseWixSearchPage(html, "great", 1, 0);
    assert.equal(result.apps[0].appSlug, "my-great-app");
    assert.equal(result.apps[0].appName, "My Great App");
  });

  it("parses short description", () => {
    const html = buildSearchHtml({
      apps: [{ slug: "app", name: "App", shortDescription: "Build amazing forms" }],
    });
    const result = parseWixSearchPage(html, "form", 1, 0);
    assert.equal(result.apps[0].shortDescription, "Build amazing forms");
  });

  it("parses rating and review count", () => {
    const html = buildSearchHtml({
      apps: [{ slug: "app", name: "App", rating: 4.8, reviewCount: 2500 }],
    });
    const result = parseWixSearchPage(html, "test", 1, 0);
    assert.equal(result.apps[0].averageRating, 4.8);
    assert.equal(result.apps[0].ratingCount, 2500);
  });

  it("parses logo URL", () => {
    const html = buildSearchHtml({
      apps: [{ slug: "app", name: "App", icon: "https://cdn.wix.com/app/icon.png" }],
    });
    const result = parseWixSearchPage(html, "test", 1, 0);
    assert.equal(result.apps[0].logoUrl, "https://cdn.wix.com/app/icon.png");
  });

  it("pricing hint: FREE", () => {
    const html = buildSearchHtml({
      apps: [{ slug: "app", name: "App", pricingType: "FREE" }],
    });
    const result = parseWixSearchPage(html, "test", 1, 0);
    assert.equal(result.apps[0].pricingHint, "Free");
  });

  it("pricing hint: FREE_PLAN_AVAILABLE", () => {
    const html = buildSearchHtml({
      apps: [{ slug: "app", name: "App", pricingType: "FREE_PLAN_AVAILABLE" }],
    });
    const result = parseWixSearchPage(html, "test", 1, 0);
    assert.equal(result.apps[0].pricingHint, "Free plan available");
  });

  it("pricing hint: Paid (any other type)", () => {
    const html = buildSearchHtml({
      apps: [{ slug: "app", name: "App", pricingType: "SUBSCRIPTION" }],
    });
    const result = parseWixSearchPage(html, "test", 1, 0);
    assert.equal(result.apps[0].pricingHint, "Paid");
  });

  it("all results are marked as non-sponsored", () => {
    const html = buildSearchHtml({
      apps: [
        { slug: "app-1", name: "App 1" },
        { slug: "app-2", name: "App 2" },
      ],
    });
    const result = parseWixSearchPage(html, "test", 1, 0);
    assert.equal(result.apps[0].isSponsored, false);
    assert.equal(result.apps[1].isSponsored, false);
  });

  it("parses badges from search results", () => {
    const html = buildSearchHtml({
      apps: [{ slug: "app", name: "App", badges: ["POPULAR", "NEW"] }],
    });
    const result = parseWixSearchPage(html, "test", 1, 0);
    assert.deepEqual(result.apps[0].badges, ["POPULAR", "NEW"]);
  });

  it("respects hasNext from paging", () => {
    const html = buildSearchHtml({ hasNext: true });
    const result = parseWixSearchPage(html, "test", 1, 0);
    assert.equal(result.hasNextPage, true);
  });

  it("handles totalResults from paging data", () => {
    const html = buildSearchHtml({ total: 150, apps: [{ slug: "a", name: "A" }] });
    const result = parseWixSearchPage(html, "test", 1, 0);
    assert.equal(result.totalResults, 150);
  });

  it("falls back to app count when paging total is missing", () => {
    // Build manually without paging.total
    const state = {
      queries: [
        {
          queryKey: ["initial-apps-fetch-en-0-search-false"],
          state: {
            data: {
              appGroup: {
                apps: [
                  { slug: "a", name: "A", reviews: {}, pricing: {}, appBadges: [] },
                  { slug: "b", name: "B", reviews: {}, pricing: {}, appBadges: [] },
                ],
              },
              paging: { hasNext: false },
            },
          },
        },
      ],
    };
    const html = buildWixHtml(state);
    const result = parseWixSearchPage(html, "test", 1, 0);
    assert.equal(result.totalResults, 2);
  });

  it("returns empty results when no search data found", () => {
    const html = buildWixHtml({ queries: [] });
    const result = parseWixSearchPage(html, "nonexistent", 1, 0);
    assert.equal(result.totalResults, null);
    assert.equal(result.apps.length, 0);
    assert.equal(result.hasNextPage, false);
    assert.equal(result.keyword, "nonexistent");
  });

  it("returns empty results when HTML has no __REACT_QUERY_STATE__", () => {
    const result = parseWixSearchPage("<html><body>Empty</body></html>", "test", 1, 0);
    assert.equal(result.apps.length, 0);
    assert.equal(result.totalResults, null);
  });

  it("handles missing fields gracefully (defaults to empty/zero)", () => {
    const state = {
      queries: [
        {
          queryKey: ["initial-apps-fetch-en-0-search-false"],
          state: {
            data: {
              appGroup: {
                apps: [{ slug: "minimal" }],
              },
              paging: {},
            },
          },
        },
      ],
    };
    const html = buildWixHtml(state);
    const result = parseWixSearchPage(html, "test", 1, 0);
    assert.equal(result.apps.length, 1);
    assert.equal(result.apps[0].appName, "");
    assert.equal(result.apps[0].averageRating, 0);
    assert.equal(result.apps[0].ratingCount, 0);
    assert.equal(result.apps[0].logoUrl, "");
  });
});
