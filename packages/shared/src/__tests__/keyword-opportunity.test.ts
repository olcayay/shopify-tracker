import { describe, it, expect } from "vitest";
import {
  computeKeywordOpportunity,
  OPPORTUNITY_WEIGHTS,
} from "../keyword-opportunity.js";
import type { KeywordSearchApp } from "../types/keyword.js";

function makeApp(overrides: Partial<KeywordSearchApp> = {}): KeywordSearchApp {
  return {
    position: 1,
    app_slug: "test-app",
    app_name: "Test App",
    short_description: "desc",
    average_rating: 4.5,
    rating_count: 100,
    app_url: "/apps/test-app",
    logo_url: "https://example.com/icon.png",
    pricing_hint: "Free",
    is_sponsored: false,
    is_built_in: false,
    is_built_for_shopify: false,
    ...overrides,
  };
}

function makeResults(count: number, overrides: Partial<KeywordSearchApp> = {}): KeywordSearchApp[] {
  return Array.from({ length: count }, (_, i) =>
    makeApp({ position: i + 1, app_slug: `app-${i}`, app_name: `App ${i}`, ...overrides })
  );
}

// ---------------------------------------------------------------------------
// OPPORTUNITY_WEIGHTS
// ---------------------------------------------------------------------------
describe("OPPORTUNITY_WEIGHTS", () => {
  it("weights sum to 1.0", () => {
    const sum = Object.values(OPPORTUNITY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it("room has the highest weight", () => {
    expect(OPPORTUNITY_WEIGHTS.room).toBe(0.4);
  });

  it("maturity has the lowest weight", () => {
    expect(OPPORTUNITY_WEIGHTS.maturity).toBe(0.1);
  });
});

// ---------------------------------------------------------------------------
// computeKeywordOpportunity
// ---------------------------------------------------------------------------
describe("computeKeywordOpportunity", () => {
  // -- Basic --
  it("returns results for empty input", () => {
    const result = computeKeywordOpportunity([], null);
    expect(result.opportunityScore).toBeGreaterThanOrEqual(0);
    expect(result.topApps).toHaveLength(0);
  });

  it("all score components are between 0 and 1", () => {
    const apps = makeResults(24);
    const result = computeKeywordOpportunity(apps, 500);
    for (const key of ["room", "demand", "maturity", "quality"] as const) {
      expect(result.scores[key]).toBeGreaterThanOrEqual(0);
      expect(result.scores[key]).toBeLessThanOrEqual(1);
    }
  });

  it("opportunityScore is between 0 and 100", () => {
    const apps = makeResults(24, { rating_count: 50 });
    const result = computeKeywordOpportunity(apps, 300);
    expect(result.opportunityScore).toBeGreaterThanOrEqual(0);
    expect(result.opportunityScore).toBeLessThanOrEqual(100);
  });

  // -- Filtering --
  it("filters out sponsored apps", () => {
    const apps = [
      makeApp({ app_slug: "organic", is_sponsored: false }),
      makeApp({ app_slug: "sponsored", is_sponsored: true }),
    ];
    const result = computeKeywordOpportunity(apps, 100);
    expect(result.topApps).toHaveLength(1);
    expect(result.topApps[0].slug).toBe("organic");
  });

  it("filters out built-in apps", () => {
    const apps = [
      makeApp({ app_slug: "organic", is_built_in: false }),
      makeApp({ app_slug: "builtin", is_built_in: true }),
    ];
    const result = computeKeywordOpportunity(apps, 100);
    expect(result.topApps).toHaveLength(1);
  });

  // -- Stats --
  it("counts certified apps (badges or is_built_for_shopify)", () => {
    const apps = [
      makeApp({ app_slug: "a1", is_built_for_shopify: true }),
      makeApp({ app_slug: "a2", badges: ["cloud_fortified"] }),
      makeApp({ app_slug: "a3", is_built_for_shopify: false }),
    ];
    const result = computeKeywordOpportunity(apps, 100);
    expect(result.stats.certifiedCount).toBe(2);
    expect(result.stats.bfsCount).toBe(2); // backward compat alias
  });

  it("counts apps with 1000+ and 100+ reviews", () => {
    const apps = [
      makeApp({ app_slug: "a1", rating_count: 2000 }),
      makeApp({ app_slug: "a2", rating_count: 1000 }),
      makeApp({ app_slug: "a3", rating_count: 500 }),
      makeApp({ app_slug: "a4", rating_count: 50 }),
    ];
    const result = computeKeywordOpportunity(apps, 100);
    expect(result.stats.count1000).toBe(2);
    expect(result.stats.count100).toBe(3);
  });

  it("computes correct top4 average rating", () => {
    const apps = [
      makeApp({ app_slug: "a1", average_rating: 5.0 }),
      makeApp({ app_slug: "a2", average_rating: 4.0 }),
      makeApp({ app_slug: "a3", average_rating: 3.0 }),
      makeApp({ app_slug: "a4", average_rating: 4.0 }),
    ];
    const result = computeKeywordOpportunity(apps, 100);
    expect(result.stats.top4AvgRating).toBe(4.0);
  });

  it("top4AvgRating is null when no apps have ratings", () => {
    const apps = makeResults(4, { average_rating: 0 });
    const result = computeKeywordOpportunity(apps, 100);
    expect(result.stats.top4AvgRating).toBeNull();
  });

  it("computes review shares correctly", () => {
    const apps = [
      makeApp({ app_slug: "a1", rating_count: 500 }),
      makeApp({ app_slug: "a2", rating_count: 200 }),
      makeApp({ app_slug: "a3", rating_count: 200 }),
      makeApp({ app_slug: "a4", rating_count: 100 }),
    ];
    const result = computeKeywordOpportunity(apps, 100);
    expect(result.stats.top1ReviewShare).toBe(0.5);
    expect(result.stats.top4ReviewShare).toBe(1.0);
  });

  it("top1ReviewShare is 0 when firstPageTotalReviews is 0", () => {
    const apps = makeResults(4, { rating_count: 0 });
    const result = computeKeywordOpportunity(apps, 100);
    expect(result.stats.top1ReviewShare).toBe(0);
  });

  it("returns top 4 apps info", () => {
    const apps = makeResults(10);
    const result = computeKeywordOpportunity(apps, 100);
    expect(result.topApps).toHaveLength(4);
    expect(result.topApps[0].slug).toBe("app-0");
    expect(result.topApps[3].slug).toBe("app-3");
  });

  it("returns fewer than 4 top apps when results are short", () => {
    const apps = makeResults(2);
    const result = computeKeywordOpportunity(apps, 50);
    expect(result.topApps).toHaveLength(2);
  });

  it("topApps include correct fields", () => {
    const apps = [
      makeApp({
        app_slug: "test-slug",
        app_name: "Test Name",
        logo_url: "https://example.com/logo.png",
        average_rating: 4.8,
        rating_count: 200,
        is_built_for_shopify: true,
        badges: ["built_for_shopify"],
      }),
    ];
    const result = computeKeywordOpportunity(apps, 100);
    expect(result.topApps[0]).toEqual({
      slug: "test-slug",
      name: "Test Name",
      logoUrl: "https://example.com/logo.png",
      rating: 4.8,
      reviews: 200,
      isBuiltForShopify: true,
      badges: ["built_for_shopify"],
    });
  });

  // -- Room --
  it("room is high when top 4 have few reviews", () => {
    const apps = makeResults(24, { rating_count: 10 });
    const result = computeKeywordOpportunity(apps, 500);
    expect(result.scores.room).toBeGreaterThan(0.9);
  });

  it("room is 0 when top 4 have many reviews", () => {
    const apps = makeResults(24, { rating_count: 5000 });
    const result = computeKeywordOpportunity(apps, 500);
    expect(result.scores.room).toBe(0);
  });

  // -- Demand --
  it("demand is 1 when totalResults >= 1000", () => {
    const apps = makeResults(5);
    const result = computeKeywordOpportunity(apps, 2000);
    expect(result.scores.demand).toBe(1);
  });

  it("demand is low when totalResults is small", () => {
    const apps = makeResults(5);
    const result = computeKeywordOpportunity(apps, 50);
    expect(result.scores.demand).toBe(0.05);
  });

  it("demand handles null totalResults (treated as 0)", () => {
    const apps = makeResults(5);
    const result = computeKeywordOpportunity(apps, null);
    expect(result.scores.demand).toBe(0);
  });

  // -- Maturity --
  it("maturity is 1 when no apps have 1000+ reviews", () => {
    const apps = makeResults(24, { rating_count: 50 });
    const result = computeKeywordOpportunity(apps, 500);
    expect(result.scores.maturity).toBe(1);
  });

  it("maturity decreases with more 1000+ review apps", () => {
    const apps = makeResults(24, { rating_count: 2000 });
    const result = computeKeywordOpportunity(apps, 500);
    expect(result.scores.maturity).toBe(0);
  });

  // -- Quality --
  it("quality is high when few certified apps and low ratings", () => {
    const apps = makeResults(24, {
      average_rating: 3.0,
      is_built_for_shopify: false,
    });
    const result = computeKeywordOpportunity(apps, 500);
    expect(result.scores.quality).toBeGreaterThan(0.5);
  });

  it("quality is 0 when many certified apps and high ratings", () => {
    const apps = makeResults(24, {
      average_rating: 5.0,
      is_built_for_shopify: true,
    });
    const result = computeKeywordOpportunity(apps, 500);
    expect(result.scores.quality).toBe(0);
  });

  it("quality uses 0.5 for ratingFactor when top4AvgRating is null", () => {
    const apps = makeResults(4, { average_rating: 0, is_built_for_shopify: false });
    const result = computeKeywordOpportunity(apps, 100);
    // certifiedFactor = 1 (no BFS), ratingFactor = 0.5 (null avg)
    expect(result.scores.quality).toBeCloseTo(0.5, 2);
  });

  // -- Composite --
  it("high opportunity scenario", () => {
    const apps = makeResults(24, {
      rating_count: 10,
      average_rating: 3.0,
      is_built_for_shopify: false,
    });
    const result = computeKeywordOpportunity(apps, 2000);
    expect(result.opportunityScore).toBeGreaterThan(70);
  });

  it("low opportunity scenario", () => {
    const apps = Array.from({ length: 24 }, (_, i) =>
      makeApp({
        position: i + 1,
        app_slug: `app-${i}`,
        rating_count: 5000,
        average_rating: 4.9,
        is_built_for_shopify: true,
      })
    );
    const result = computeKeywordOpportunity(apps, 50);
    expect(result.opportunityScore).toBeLessThan(20);
  });

  // -- Custom page size --
  it("respects custom pageSize parameter", () => {
    const apps = makeResults(10, { is_built_for_shopify: true });
    // With pageSize=5, only first 5 organic apps on first page
    const result = computeKeywordOpportunity(apps, 100, 5);
    expect(result.stats.certifiedCount).toBe(5); // only counts first 5
  });
});
