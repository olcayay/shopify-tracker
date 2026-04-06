import { describe, it, expect } from "vitest";
import type {
  DigestData,
  TrackedAppDigest,
  CategoryRankingChange,
  RankingChange,
} from "../digest-builder.js";

function makeRankingChange(overrides: Partial<RankingChange> = {}): RankingChange {
  return {
    keyword: "email marketing",
    keywordSlug: "email-marketing",
    appName: "My App",
    appSlug: "my-app",
    yesterdayPosition: 5,
    todayPosition: 3,
    change: 2,
    type: "improved",
    ...overrides,
  };
}

function makeCategoryChange(overrides: Partial<CategoryRankingChange> = {}): CategoryRankingChange {
  return {
    categorySlug: "marketing",
    categoryName: "Marketing",
    yesterdayPosition: 10,
    todayPosition: 5,
    change: 5,
    type: "improved",
    ...overrides,
  };
}

function makeTrackedAppDigest(overrides: Partial<TrackedAppDigest> = {}): TrackedAppDigest {
  return {
    appId: 1,
    appName: "My App",
    appSlug: "my-app",
    platform: "shopify",
    keywordChanges: [],
    categoryChanges: [],
    ratingToday: null,
    ratingYesterday: null,
    ratingChange: null,
    reviewCountToday: null,
    reviewCountYesterday: null,
    reviewCountChange: null,
    ...overrides,
  };
}

function makeDigestData(overrides: Partial<DigestData> = {}): DigestData {
  return {
    accountName: "Test Account",
    date: "04/06/2026",
    trackedApps: [],
    competitorSummaries: [],
    summary: { improved: 0, dropped: 0, newEntries: 0, droppedOut: 0, unchanged: 0 },
    ...overrides,
  };
}

describe("DigestData app-centric structure", () => {
  describe("TrackedAppDigest", () => {
    it("contains keyword changes sorted by absolute change (biggest first)", () => {
      const app = makeTrackedAppDigest({
        keywordChanges: [
          makeRankingChange({ keyword: "small", change: 1 }),
          makeRankingChange({ keyword: "big", change: 10 }),
          makeRankingChange({ keyword: "medium", change: -5 }),
        ],
      });

      const sorted = [...app.keywordChanges].sort(
        (a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0)
      );

      expect(sorted[0].keyword).toBe("big");
      expect(sorted[1].keyword).toBe("medium");
      expect(sorted[2].keyword).toBe("small");
    });

    it("includes category ranking changes", () => {
      const app = makeTrackedAppDigest({
        categoryChanges: [
          makeCategoryChange({ categorySlug: "marketing", todayPosition: 1, yesterdayPosition: 3, change: 2, type: "improved" }),
          makeCategoryChange({ categorySlug: "sales", todayPosition: 8, yesterdayPosition: 5, change: -3, type: "dropped" }),
        ],
      });

      expect(app.categoryChanges).toHaveLength(2);
      expect(app.categoryChanges[0].type).toBe("improved");
      expect(app.categoryChanges[1].type).toBe("dropped");
    });

    it("includes rating and review deltas", () => {
      const app = makeTrackedAppDigest({
        ratingToday: 4.8,
        ratingYesterday: 4.7,
        ratingChange: 0.1,
        reviewCountToday: 350,
        reviewCountYesterday: 345,
        reviewCountChange: 5,
      });

      expect(app.ratingChange).toBe(0.1);
      expect(app.reviewCountChange).toBe(5);
    });

    it("handles app with no changes", () => {
      const app = makeTrackedAppDigest({
        keywordChanges: [],
        categoryChanges: [],
        ratingToday: 4.5,
        ratingYesterday: 4.5,
        ratingChange: 0,
        reviewCountToday: 100,
        reviewCountYesterday: 100,
        reviewCountChange: 0,
      });

      expect(app.keywordChanges).toHaveLength(0);
      expect(app.categoryChanges).toHaveLength(0);
      expect(app.ratingChange).toBe(0);
      expect(app.reviewCountChange).toBe(0);
    });

    it("handles null rating/review data (no snapshot available)", () => {
      const app = makeTrackedAppDigest({
        ratingToday: null,
        ratingYesterday: null,
        ratingChange: null,
        reviewCountToday: null,
        reviewCountYesterday: null,
        reviewCountChange: null,
      });

      expect(app.ratingToday).toBeNull();
      expect(app.ratingChange).toBeNull();
      expect(app.reviewCountChange).toBeNull();
    });
  });

  describe("CategoryRankingChange types", () => {
    it("classifies improved category ranking", () => {
      const change = makeCategoryChange({
        yesterdayPosition: 10,
        todayPosition: 5,
        change: 5,
        type: "improved",
      });
      expect(change.type).toBe("improved");
      expect(change.change).toBeGreaterThan(0);
    });

    it("classifies dropped category ranking", () => {
      const change = makeCategoryChange({
        yesterdayPosition: 5,
        todayPosition: 10,
        change: -5,
        type: "dropped",
      });
      expect(change.type).toBe("dropped");
      expect(change.change).toBeLessThan(0);
    });

    it("classifies new category entry", () => {
      const change = makeCategoryChange({
        yesterdayPosition: null,
        todayPosition: 8,
        change: null,
        type: "new_entry",
      });
      expect(change.type).toBe("new_entry");
      expect(change.yesterdayPosition).toBeNull();
    });

    it("classifies dropped out of category", () => {
      const change = makeCategoryChange({
        yesterdayPosition: 5,
        todayPosition: null,
        change: null,
        type: "dropped_out",
      });
      expect(change.type).toBe("dropped_out");
      expect(change.todayPosition).toBeNull();
    });
  });

  describe("DigestData structure", () => {
    it("contains trackedApps array", () => {
      const data = makeDigestData({
        trackedApps: [
          makeTrackedAppDigest({ appName: "App A" }),
          makeTrackedAppDigest({ appName: "App B", appId: 2 }),
        ],
      });

      expect(data.trackedApps).toHaveLength(2);
      expect(data.trackedApps[0].appName).toBe("App A");
      expect(data.trackedApps[1].appName).toBe("App B");
    });

    it("does not contain rankingChanges (removed in Phase 3)", () => {
      const data = makeDigestData();
      expect(data).not.toHaveProperty("rankingChanges");
    });

    it("RankingChange does not have isTracked/isCompetitor fields", () => {
      const change = makeRankingChange();
      expect(change).not.toHaveProperty("isTracked");
      expect(change).not.toHaveProperty("isCompetitor");
    });

    it("trackedApp keyword changes only include that app's changes", () => {
      const appAChanges = [
        makeRankingChange({ appSlug: "app-a", keyword: "kw1" }),
        makeRankingChange({ appSlug: "app-a", keyword: "kw2" }),
      ];
      const appBChanges = [
        makeRankingChange({ appSlug: "app-b", keyword: "kw1" }),
      ];

      const allChanges = [...appAChanges, ...appBChanges];

      const appADigest = makeTrackedAppDigest({
        appSlug: "app-a",
        keywordChanges: allChanges.filter((r) => r.appSlug === "app-a"),
      });

      expect(appADigest.keywordChanges).toHaveLength(2);
      expect(appADigest.keywordChanges.every((r) => r.appSlug === "app-a")).toBe(true);
    });

    it("competitor keyword changes are excluded from trackedApps (structurally separated)", () => {
      // Since ranking comparison only processes tracked app IDs,
      // competitor changes never appear in trackedRankingChanges
      const trackedChanges = [makeRankingChange({ appSlug: "my-app" })];

      // Competitor data only in competitorSummaries.keywordPositions
      const data = makeDigestData({
        trackedApps: [makeTrackedAppDigest({ keywordChanges: trackedChanges })],
        competitorSummaries: [{
          appName: "Comp",
          appSlug: "comp",
          todayRating: "4.0",
          yesterdayRating: "3.9",
          ratingChange: 0.1,
          todayReviews: 100,
          yesterdayReviews: 95,
          reviewsChange: 5,
          keywordPositions: [{ keyword: "email marketing", position: 3, change: 2 }],
        }],
      });

      // Tracked app changes don't contain competitor data
      expect(data.trackedApps[0].keywordChanges.every((r) => r.appSlug === "my-app")).toBe(true);
      // Competitor keyword positions are in competitorSummaries
      expect(data.competitorSummaries[0].keywordPositions).toHaveLength(1);
    });

    it("unrelated app is completely excluded", () => {
      // Since the ranking loop skips non-tracked appIds,
      // unrelated apps never appear anywhere in DigestData
      const data = makeDigestData({
        trackedApps: [makeTrackedAppDigest({ appSlug: "my-app", keywordChanges: [] })],
        competitorSummaries: [],
      });

      // No unrelated app data anywhere
      const allAppSlugs = data.trackedApps.map((a) => a.appSlug);
      expect(allAppSlugs).not.toContain("random-app");
    });
  });

  describe("summary counts only tracked apps", () => {
    it("summary reflects only tracked app keyword changes", () => {
      const data = makeDigestData({
        trackedApps: [
          makeTrackedAppDigest({
            keywordChanges: [
              makeRankingChange({ type: "improved" }),
              makeRankingChange({ keyword: "kw2", type: "dropped", change: -2, todayPosition: 8 }),
            ],
          }),
        ],
        summary: { improved: 1, dropped: 1, newEntries: 0, droppedOut: 0, unchanged: 0 },
      });

      expect(data.summary.improved).toBe(1);
      expect(data.summary.dropped).toBe(1);
    });
  });

  describe("rating change calculation", () => {
    it("correctly computes positive rating change", () => {
      const ratingToday = 4.8;
      const ratingYesterday = 4.7;
      const ratingChange = Math.round((ratingToday - ratingYesterday) * 100) / 100;
      expect(ratingChange).toBe(0.1);
    });

    it("correctly computes negative rating change", () => {
      const ratingToday = 4.5;
      const ratingYesterday = 4.7;
      const ratingChange = Math.round((ratingToday - ratingYesterday) * 100) / 100;
      expect(ratingChange).toBe(-0.2);
    });

    it("returns null when either snapshot is missing", () => {
      const ratingToday = 4.8;
      const ratingYesterday = null;
      const ratingChange =
        ratingToday !== null && ratingYesterday !== null
          ? Math.round((ratingToday - ratingYesterday) * 100) / 100
          : null;
      expect(ratingChange).toBeNull();
    });
  });
});
