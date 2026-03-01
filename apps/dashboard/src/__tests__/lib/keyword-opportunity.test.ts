import { describe, it, expect } from "vitest";
import {
  computeKeywordOpportunity,
  OPPORTUNITY_WEIGHTS,
} from "@shopify-tracking/shared";
import type { KeywordSearchApp } from "@shopify-tracking/shared";

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

describe("OPPORTUNITY_WEIGHTS", () => {
  it("weights sum to 1.0", () => {
    const sum = Object.values(OPPORTUNITY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });
});

describe("computeKeywordOpportunity", () => {
  it("returns zero score for empty results", () => {
    const result = computeKeywordOpportunity([], null);
    expect(result.opportunityScore).toBeGreaterThanOrEqual(0);
    expect(result.stats.organicCount).toBe(0);
    expect(result.topApps).toHaveLength(0);
  });

  it("returns all score components between 0 and 1", () => {
    const apps = makeResults(24);
    const result = computeKeywordOpportunity(apps, 500);
    expect(result.scores.room).toBeGreaterThanOrEqual(0);
    expect(result.scores.room).toBeLessThanOrEqual(1);
    expect(result.scores.demand).toBeGreaterThanOrEqual(0);
    expect(result.scores.demand).toBeLessThanOrEqual(1);
    expect(result.scores.maturity).toBeGreaterThanOrEqual(0);
    expect(result.scores.maturity).toBeLessThanOrEqual(1);
    expect(result.scores.quality).toBeGreaterThanOrEqual(0);
    expect(result.scores.quality).toBeLessThanOrEqual(1);
  });

  it("opportunityScore is between 0 and 100", () => {
    const apps = makeResults(24, { rating_count: 50 });
    const result = computeKeywordOpportunity(apps, 300);
    expect(result.opportunityScore).toBeGreaterThanOrEqual(0);
    expect(result.opportunityScore).toBeLessThanOrEqual(100);
  });

  it("filters out sponsored and built-in apps from organic count", () => {
    const apps = [
      makeApp({ position: 1, app_slug: "organic-1" }),
      makeApp({ position: 2, app_slug: "sponsored-1", is_sponsored: true }),
      makeApp({ position: 3, app_slug: "builtin-1", is_built_in: true }),
      makeApp({ position: 4, app_slug: "organic-2" }),
    ];
    const result = computeKeywordOpportunity(apps, 100);
    expect(result.stats.organicCount).toBe(2);
  });

  it("counts BFS apps on first page", () => {
    const apps = [
      makeApp({ app_slug: "a1", is_built_for_shopify: true }),
      makeApp({ app_slug: "a2", is_built_for_shopify: true }),
      makeApp({ app_slug: "a3", is_built_for_shopify: false }),
    ];
    const result = computeKeywordOpportunity(apps, 100);
    expect(result.stats.bfsCount).toBe(2);
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

  // --- Room ---
  it("room is high when top 8 have few reviews", () => {
    const apps = makeResults(24, { rating_count: 10 });
    const result = computeKeywordOpportunity(apps, 500);
    expect(result.scores.room).toBeGreaterThan(0.9);
  });

  it("room is low when top 8 have many reviews", () => {
    const apps = makeResults(24, { rating_count: 5000 });
    const result = computeKeywordOpportunity(apps, 500);
    expect(result.scores.room).toBe(0);
  });

  // --- Demand ---
  it("demand is high when totalResults is large", () => {
    const apps = makeResults(5);
    const result = computeKeywordOpportunity(apps, 2000);
    expect(result.scores.demand).toBe(1);
  });

  it("demand is low when totalResults is small", () => {
    const apps = makeResults(5);
    const result = computeKeywordOpportunity(apps, 50);
    expect(result.scores.demand).toBe(0.05);
  });

  // --- Maturity ---
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

  // --- Quality ---
  it("quality is high when few BFS apps and low ratings", () => {
    const apps = makeResults(24, {
      average_rating: 3.0,
      is_built_for_shopify: false,
    });
    const result = computeKeywordOpportunity(apps, 500);
    expect(result.scores.quality).toBeGreaterThan(0.5);
  });

  it("quality is low when many BFS apps and high ratings", () => {
    const apps = makeResults(24, {
      average_rating: 5.0,
      is_built_for_shopify: true,
    });
    const result = computeKeywordOpportunity(apps, 500);
    expect(result.scores.quality).toBe(0);
  });

  // --- Composite ---
  it("high opportunity scenario: few reviews, high demand, no BFS, low ratings", () => {
    const apps = makeResults(24, {
      rating_count: 10,
      average_rating: 3.0,
      is_built_for_shopify: false,
    });
    const result = computeKeywordOpportunity(apps, 2000);
    expect(result.opportunityScore).toBeGreaterThan(70);
  });

  it("low opportunity scenario: many reviews, low demand, many BFS, high ratings", () => {
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
});
