import { describe, it, expect } from "vitest";
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
    expect(result.keyword).toBe("form");
    expect(result.totalResults).toBe(48);
    expect(result.apps.length).toBe(2);
    expect(result.currentPage).toBe(1);
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
    expect(result.apps[0].position).toBe(1);
    expect(result.apps[1].position).toBe(2);
    expect(result.apps[2].position).toBe(3);
  });

  it("applies offset to positions", () => {
    const html = buildSearchHtml({
      apps: [
        { slug: "app-1", name: "App 1" },
        { slug: "app-2", name: "App 2" },
      ],
    });
    const result = parseWixSearchPage(html, "test", 2, 50);
    expect(result.apps[0].position).toBe(51);
    expect(result.apps[1].position).toBe(52);
    expect(result.currentPage).toBe(2);
  });

  it("parses app slug and name", () => {
    const html = buildSearchHtml({
      apps: [{ slug: "my-great-app", name: "My Great App" }],
    });
    const result = parseWixSearchPage(html, "great", 1, 0);
    expect(result.apps[0].appSlug).toBe("my-great-app");
    expect(result.apps[0].appName).toBe("My Great App");
  });

  it("parses short description", () => {
    const html = buildSearchHtml({
      apps: [{ slug: "app", name: "App", shortDescription: "Build amazing forms" }],
    });
    const result = parseWixSearchPage(html, "form", 1, 0);
    expect(result.apps[0].shortDescription).toBe("Build amazing forms");
  });

  it("parses rating and review count", () => {
    const html = buildSearchHtml({
      apps: [{ slug: "app", name: "App", rating: 4.8, reviewCount: 2500 }],
    });
    const result = parseWixSearchPage(html, "test", 1, 0);
    expect(result.apps[0].averageRating).toBe(4.8);
    expect(result.apps[0].ratingCount).toBe(2500);
  });

  it("parses logo URL", () => {
    const html = buildSearchHtml({
      apps: [{ slug: "app", name: "App", icon: "https://cdn.wix.com/app/icon.png" }],
    });
    const result = parseWixSearchPage(html, "test", 1, 0);
    expect(result.apps[0].logoUrl).toBe("https://cdn.wix.com/app/icon.png");
  });

  it("pricing hint: FREE", () => {
    const html = buildSearchHtml({
      apps: [{ slug: "app", name: "App", pricingType: "FREE" }],
    });
    const result = parseWixSearchPage(html, "test", 1, 0);
    expect(result.apps[0].pricingHint).toBe("Free");
  });

  it("pricing hint: FREE_PLAN_AVAILABLE", () => {
    const html = buildSearchHtml({
      apps: [{ slug: "app", name: "App", pricingType: "FREE_PLAN_AVAILABLE" }],
    });
    const result = parseWixSearchPage(html, "test", 1, 0);
    expect(result.apps[0].pricingHint).toBe("Free plan available");
  });

  it("pricing hint: Paid (any other type)", () => {
    const html = buildSearchHtml({
      apps: [{ slug: "app", name: "App", pricingType: "SUBSCRIPTION" }],
    });
    const result = parseWixSearchPage(html, "test", 1, 0);
    expect(result.apps[0].pricingHint).toBe("Paid");
  });

  it("all results are marked as non-sponsored", () => {
    const html = buildSearchHtml({
      apps: [
        { slug: "app-1", name: "App 1" },
        { slug: "app-2", name: "App 2" },
      ],
    });
    const result = parseWixSearchPage(html, "test", 1, 0);
    expect(result.apps[0].isSponsored).toBe(false);
    expect(result.apps[1].isSponsored).toBe(false);
  });

  it("parses badges from search results", () => {
    const html = buildSearchHtml({
      apps: [{ slug: "app", name: "App", badges: ["POPULAR", "NEW"] }],
    });
    const result = parseWixSearchPage(html, "test", 1, 0);
    expect(result.apps[0].badges).toEqual(["POPULAR", "NEW"]);
  });

  it("respects hasNext from paging", () => {
    const html = buildSearchHtml({ hasNext: true });
    const result = parseWixSearchPage(html, "test", 1, 0);
    expect(result.hasNextPage).toBe(true);
  });

  it("handles totalResults from paging data", () => {
    const html = buildSearchHtml({ total: 150, apps: [{ slug: "a", name: "A" }] });
    const result = parseWixSearchPage(html, "test", 1, 0);
    expect(result.totalResults).toBe(150);
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
    expect(result.totalResults).toBe(2);
  });

  it("returns empty results when no search data found", () => {
    const html = buildWixHtml({ queries: [] });
    const result = parseWixSearchPage(html, "nonexistent", 1, 0);
    expect(result.totalResults).toBe(null);
    expect(result.apps.length).toBe(0);
    expect(result.hasNextPage).toBe(false);
    expect(result.keyword).toBe("nonexistent");
  });

  it("returns empty results when HTML has no __REACT_QUERY_STATE__", () => {
    const result = parseWixSearchPage("<html><body>Empty</body></html>", "test", 1, 0);
    expect(result.apps.length).toBe(0);
    expect(result.totalResults).toBe(null);
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
    expect(result.apps.length).toBe(1);
    expect(result.apps[0].appName).toBe("");
    expect(result.apps[0].averageRating).toBe(0);
    expect(result.apps[0].ratingCount).toBe(0);
    expect(result.apps[0].logoUrl).toBe("");
  });
});
