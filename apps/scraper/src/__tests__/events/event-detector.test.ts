import { describe, it, expect } from "vitest";
import {
  checkRankingAlerts,
  checkCategoryAlerts,
  checkCompetitorMoves,
  checkNewReviews,
  detectMilestones,
  checkFeaturedChanges,
  DEFAULT_THRESHOLDS,
  type RankingSnapshot,
  type CategoryRankingSnapshot,
  type CompetitorSnapshot,
  type ReviewSnapshot,
  type AppMetrics,
  type FeaturedSnapshot,
} from "../../events/event-detector.js";

const APP = { appId: 1, appSlug: "test-app", appName: "Test App", platform: "shopify" };

describe("checkRankingAlerts", () => {
  const prev: RankingSnapshot[] = [
    { keywordId: 1, keywordSlug: "seo", keyword: "seo", position: 5 },
    { keywordId: 2, keywordSlug: "email", keyword: "email", position: 2 },
    { keywordId: 3, keywordSlug: "crm", keyword: "crm", position: 8 },
    { keywordId: 4, keywordSlug: "chat", keyword: "chat", position: 15 },
  ];

  it("detects top 3 entry", () => {
    const cur: RankingSnapshot[] = [
      { keywordId: 1, keywordSlug: "seo", keyword: "seo", position: 2 },
      ...prev.slice(1),
    ];
    const events = checkRankingAlerts(APP.appId, APP.appSlug, APP.appName, APP.platform, cur, prev);
    expect(events.some((e) => e.type === "ranking_top3_entry" && e.data.keyword === "seo")).toBe(true);
  });

  it("detects top 3 exit", () => {
    const cur: RankingSnapshot[] = [
      prev[0],
      { keywordId: 2, keywordSlug: "email", keyword: "email", position: 5 },
      ...prev.slice(2),
    ];
    const events = checkRankingAlerts(APP.appId, APP.appSlug, APP.appName, APP.platform, cur, prev);
    expect(events.some((e) => e.type === "ranking_top3_exit" && e.data.keyword === "email")).toBe(true);
  });

  it("detects significant rank change (5+ positions)", () => {
    const cur: RankingSnapshot[] = [
      { keywordId: 4, keywordSlug: "chat", keyword: "chat", position: 8 },
    ];
    const prevSingle = [{ keywordId: 4, keywordSlug: "chat", keyword: "chat", position: 15 }];
    const events = checkRankingAlerts(APP.appId, APP.appSlug, APP.appName, APP.platform, cur, prevSingle);
    expect(events.some((e) => e.type === "ranking_significant_change")).toBe(true);
  });

  it("detects dropped out (position → null)", () => {
    const cur: RankingSnapshot[] = [
      { keywordId: 1, keywordSlug: "seo", keyword: "seo", position: null },
    ];
    const events = checkRankingAlerts(APP.appId, APP.appSlug, APP.appName, APP.platform, cur, prev);
    expect(events.some((e) => e.type === "ranking_dropped_out")).toBe(true);
  });

  it("detects new entry (null → position)", () => {
    const cur: RankingSnapshot[] = [
      { keywordId: 1, keywordSlug: "seo", keyword: "seo", position: 10 },
    ];
    const prevNull = [{ keywordId: 1, keywordSlug: "seo", keyword: "seo", position: null }];
    const events = checkRankingAlerts(APP.appId, APP.appSlug, APP.appName, APP.platform, cur, prevNull);
    expect(events.some((e) => e.type === "ranking_new_entry")).toBe(true);
  });

  it("detects new entry into top 3", () => {
    const cur: RankingSnapshot[] = [
      { keywordId: 1, keywordSlug: "seo", keyword: "seo", position: 2 },
    ];
    const prevNull = [{ keywordId: 1, keywordSlug: "seo", keyword: "seo", position: null }];
    const events = checkRankingAlerts(APP.appId, APP.appSlug, APP.appName, APP.platform, cur, prevNull);
    expect(events.some((e) => e.type === "ranking_top3_entry")).toBe(true);
    expect(events.some((e) => e.type === "ranking_new_entry")).toBe(true);
  });

  it("detects new keyword ranking", () => {
    const cur: RankingSnapshot[] = [
      { keywordId: 99, keywordSlug: "new-kw", keyword: "new kw", position: 7 },
    ];
    const events = checkRankingAlerts(APP.appId, APP.appSlug, APP.appName, APP.platform, cur, []);
    expect(events.some((e) => e.type === "keyword_new_ranking")).toBe(true);
  });

  it("detects position gained and lost", () => {
    const cur: RankingSnapshot[] = [
      { keywordId: 1, keywordSlug: "seo", keyword: "seo", position: 3 }, // gained (5→3)
      { keywordId: 3, keywordSlug: "crm", keyword: "crm", position: 12 }, // lost (8→12)
    ];
    const events = checkRankingAlerts(APP.appId, APP.appSlug, APP.appName, APP.platform, cur, prev);
    expect(events.some((e) => e.type === "keyword_position_gained" && e.data.keyword === "seo")).toBe(true);
    expect(events.some((e) => e.type === "keyword_position_lost" && e.data.keyword === "crm")).toBe(true);
  });

  it("returns empty array when nothing changed", () => {
    const events = checkRankingAlerts(APP.appId, APP.appSlug, APP.appName, APP.platform, prev, prev);
    expect(events).toHaveLength(0);
  });

  it("respects custom thresholds", () => {
    const cur: RankingSnapshot[] = [
      { keywordId: 1, keywordSlug: "seo", keyword: "seo", position: 2 }, // change of 3
    ];
    // With threshold of 10, this should NOT be significant
    const events = checkRankingAlerts(APP.appId, APP.appSlug, APP.appName, APP.platform, cur, prev, {
      ...DEFAULT_THRESHOLDS,
      significantRankChange: 10,
    });
    expect(events.some((e) => e.type === "ranking_significant_change")).toBe(false);
  });
});

describe("checkCategoryAlerts", () => {
  it("detects category rank change", () => {
    const prev: CategoryRankingSnapshot[] = [
      { categorySlug: "marketing", categoryName: "Marketing", position: 10 },
    ];
    const cur: CategoryRankingSnapshot[] = [
      { categorySlug: "marketing", categoryName: "Marketing", position: 5 },
    ];
    const events = checkCategoryAlerts(APP.appId, APP.appSlug, APP.appName, APP.platform, cur, prev);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("ranking_category_change");
    expect(events[0].data.change).toBe(5);
  });

  it("ignores small changes below threshold", () => {
    const prev: CategoryRankingSnapshot[] = [
      { categorySlug: "marketing", categoryName: "Marketing", position: 10 },
    ];
    const cur: CategoryRankingSnapshot[] = [
      { categorySlug: "marketing", categoryName: "Marketing", position: 9 },
    ];
    const events = checkCategoryAlerts(APP.appId, APP.appSlug, APP.appName, APP.platform, cur, prev);
    expect(events).toHaveLength(0);
  });
});

describe("checkCompetitorMoves", () => {
  const tracked = { appId: 1, appSlug: "my-app", appName: "My App" };
  const trackedPositions = { seo: 5, email: 3 };

  it("detects competitor overtake", () => {
    const prev: CompetitorSnapshot[] = [{
      appId: 2, appSlug: "comp", appName: "Comp",
      averageRating: 4.0, ratingCount: 100, isFeatured: false, pricingHint: "Free",
      keywordPositions: { seo: 8 }, // was below (8 > 5)
    }];
    const cur: CompetitorSnapshot[] = [{
      appId: 2, appSlug: "comp", appName: "Comp",
      averageRating: 4.0, ratingCount: 100, isFeatured: false, pricingHint: "Free",
      keywordPositions: { seo: 3 }, // now above (3 < 5)
    }];
    const events = checkCompetitorMoves(tracked.appId, tracked.appSlug, tracked.appName, "shopify", cur, prev, trackedPositions);
    expect(events.some((e) => e.type === "competitor_overtook")).toBe(true);
  });

  it("detects competitor featured", () => {
    const prev: CompetitorSnapshot[] = [{
      appId: 2, appSlug: "comp", appName: "Comp",
      averageRating: 4.0, ratingCount: 100, isFeatured: false, pricingHint: null,
      keywordPositions: {},
    }];
    const cur: CompetitorSnapshot[] = [{
      appId: 2, appSlug: "comp", appName: "Comp",
      averageRating: 4.0, ratingCount: 100, isFeatured: true, pricingHint: null,
      keywordPositions: {},
    }];
    const events = checkCompetitorMoves(tracked.appId, tracked.appSlug, tracked.appName, "shopify", cur, prev, trackedPositions);
    expect(events.some((e) => e.type === "competitor_featured")).toBe(true);
  });

  it("detects competitor review surge", () => {
    const prev: CompetitorSnapshot[] = [{
      appId: 2, appSlug: "comp", appName: "Comp",
      averageRating: 4.0, ratingCount: 100, isFeatured: false, pricingHint: null,
      keywordPositions: {},
    }];
    const cur: CompetitorSnapshot[] = [{
      appId: 2, appSlug: "comp", appName: "Comp",
      averageRating: 4.2, ratingCount: 115, isFeatured: false, pricingHint: null,
      keywordPositions: {},
    }];
    const events = checkCompetitorMoves(tracked.appId, tracked.appSlug, tracked.appName, "shopify", cur, prev, trackedPositions);
    expect(events.some((e) => e.type === "competitor_review_surge")).toBe(true);
  });

  it("detects competitor pricing change", () => {
    const prev: CompetitorSnapshot[] = [{
      appId: 2, appSlug: "comp", appName: "Comp",
      averageRating: 4.0, ratingCount: 100, isFeatured: false, pricingHint: "Free",
      keywordPositions: {},
    }];
    const cur: CompetitorSnapshot[] = [{
      appId: 2, appSlug: "comp", appName: "Comp",
      averageRating: 4.0, ratingCount: 100, isFeatured: false, pricingHint: "$9.99/month",
      keywordPositions: {},
    }];
    const events = checkCompetitorMoves(tracked.appId, tracked.appSlug, tracked.appName, "shopify", cur, prev, trackedPositions);
    expect(events.some((e) => e.type === "competitor_pricing_change")).toBe(true);
  });
});

describe("checkNewReviews", () => {
  it("detects new positive review", () => {
    const reviews: ReviewSnapshot[] = [
      { id: 1, rating: 5, reviewerName: "Alice", content: "Great app!", reviewDate: "2026-03-30" },
    ];
    const events = checkNewReviews(APP.appId, APP.appSlug, APP.appName, APP.platform, reviews, new Set(), null, null);
    expect(events.some((e) => e.type === "review_new_positive")).toBe(true);
  });

  it("detects new negative review", () => {
    const reviews: ReviewSnapshot[] = [
      { id: 2, rating: 1, reviewerName: "Bob", content: "Terrible!", reviewDate: "2026-03-30" },
    ];
    const events = checkNewReviews(APP.appId, APP.appSlug, APP.appName, APP.platform, reviews, new Set(), null, null);
    expect(events.some((e) => e.type === "review_new_negative")).toBe(true);
  });

  it("ignores already-seen reviews", () => {
    const reviews: ReviewSnapshot[] = [
      { id: 1, rating: 5, reviewerName: "Alice", content: "Great!", reviewDate: "2026-03-30" },
    ];
    const events = checkNewReviews(APP.appId, APP.appSlug, APP.appName, APP.platform, reviews, new Set([1]), null, null);
    expect(events).toHaveLength(0);
  });

  it("detects review velocity spike", () => {
    const curMetrics: AppMetrics = { averageRating: 4.5, ratingCount: 500, reviewVelocity7d: 30 };
    const prevMetrics: AppMetrics = { averageRating: 4.5, ratingCount: 490, reviewVelocity7d: 8 };
    const events = checkNewReviews(APP.appId, APP.appSlug, APP.appName, APP.platform, [], new Set(), curMetrics, prevMetrics);
    expect(events.some((e) => e.type === "review_velocity_spike")).toBe(true);
  });

  it("ignores velocity when previous was 0", () => {
    const curMetrics: AppMetrics = { averageRating: 4.5, ratingCount: 10, reviewVelocity7d: 5 };
    const prevMetrics: AppMetrics = { averageRating: 4.5, ratingCount: 5, reviewVelocity7d: 0 };
    const events = checkNewReviews(APP.appId, APP.appSlug, APP.appName, APP.platform, [], new Set(), curMetrics, prevMetrics);
    expect(events.some((e) => e.type === "review_velocity_spike")).toBe(false);
  });
});

describe("detectMilestones", () => {
  it("detects review count milestone", () => {
    const cur: AppMetrics = { averageRating: 4.5, ratingCount: 105, reviewVelocity7d: 5 };
    const prev: AppMetrics = { averageRating: 4.5, ratingCount: 98, reviewVelocity7d: 5 };
    const events = detectMilestones(APP.appId, APP.appSlug, APP.appName, APP.platform, cur, prev, []);
    expect(events.some((e) => e.type === "review_milestone" && e.data.milestone === 100)).toBe(true);
  });

  it("detects rating milestone crossing", () => {
    const cur: AppMetrics = { averageRating: 4.51, ratingCount: 200, reviewVelocity7d: 5 };
    const prev: AppMetrics = { averageRating: 4.48, ratingCount: 195, reviewVelocity7d: 5 };
    const events = detectMilestones(APP.appId, APP.appSlug, APP.appName, APP.platform, cur, prev, []);
    expect(events.some((e) => e.type === "rating_milestone" && e.data.milestone === 4.5)).toBe(true);
  });

  it("detects rank #1", () => {
    const rankings: RankingSnapshot[] = [
      { keywordId: 1, keywordSlug: "seo", keyword: "seo", position: 1 },
    ];
    const cur: AppMetrics = { averageRating: 4.5, ratingCount: 200, reviewVelocity7d: 5 };
    const events = detectMilestones(APP.appId, APP.appSlug, APP.appName, APP.platform, cur, null, rankings);
    expect(events.some((e) => e.type === "ranking_top1")).toBe(true);
  });

  it("returns empty with no milestones crossed", () => {
    const cur: AppMetrics = { averageRating: 4.3, ratingCount: 50, reviewVelocity7d: 2 };
    const prev: AppMetrics = { averageRating: 4.2, ratingCount: 48, reviewVelocity7d: 2 };
    const events = detectMilestones(APP.appId, APP.appSlug, APP.appName, APP.platform, cur, prev, []);
    expect(events).toHaveLength(0);
  });
});

describe("checkFeaturedChanges", () => {
  it("detects new featured placement", () => {
    const prev: FeaturedSnapshot[] = [];
    const cur: FeaturedSnapshot[] = [
      { surface: "homepage", sectionHandle: "staff-picks", position: 3 },
    ];
    const events = checkFeaturedChanges(APP.appId, APP.appSlug, APP.appName, APP.platform, cur, prev);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("featured_new_placement");
  });

  it("detects removed featured placement", () => {
    const prev: FeaturedSnapshot[] = [
      { surface: "homepage", sectionHandle: "staff-picks", position: 3 },
    ];
    const cur: FeaturedSnapshot[] = [];
    const events = checkFeaturedChanges(APP.appId, APP.appSlug, APP.appName, APP.platform, cur, prev);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("featured_removed");
  });

  it("returns empty when no changes", () => {
    const both: FeaturedSnapshot[] = [
      { surface: "homepage", sectionHandle: "staff-picks", position: 3 },
    ];
    const events = checkFeaturedChanges(APP.appId, APP.appSlug, APP.appName, APP.platform, both, both);
    expect(events).toHaveLength(0);
  });
});
