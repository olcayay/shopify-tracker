import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock event-detector and event-dispatcher before importing
vi.mock("../../events/event-detector.js", () => ({
  checkRankingAlerts: vi.fn().mockReturnValue([]),
  checkCategoryAlerts: vi.fn().mockReturnValue([]),
  checkNewReviews: vi.fn().mockReturnValue([]),
  detectMilestones: vi.fn().mockReturnValue([]),
  checkFeaturedChanges: vi.fn().mockReturnValue([]),
  checkCompetitorMoves: vi.fn().mockReturnValue([]),
}));

vi.mock("../../events/event-dispatcher.js", () => ({
  dispatchAll: vi.fn().mockResolvedValue(undefined),
}));

import { afterKeywordScrape, afterReviewScrape, afterCategoryScrape, refreshDeveloperPlatformStats } from "../../events/post-scrape-events.js";

// ---------------------------------------------------------------------------
// Mock DB helper — tracks query arguments to verify inArray usage
// ---------------------------------------------------------------------------

interface WhereCall {
  table: string;
  args: any[];
}

function createMockDb(overrides: {
  scrapeRunId?: string;
  trackedApps?: any[];
  currentRankings?: any[];
  previousRankings?: any[];
  metrics?: any[];
  reviews?: any[];
  currentCatRankings?: any[];
  previousCatRankings?: any[];
} = {}) {
  const whereCalls: WhereCall[] = [];
  let callIndex = 0;
  const expectedResults = [
    // scrape run lookup
    overrides.scrapeRunId ? [{ id: overrides.scrapeRunId }] : [],
    // tracked apps
    overrides.trackedApps ?? [],
    // current rankings / reviews / current cat
    overrides.currentRankings ?? overrides.reviews ?? overrides.currentCatRankings ?? [],
    // previous rankings / previous cat
    overrides.previousRankings ?? overrides.previousCatRankings ?? [],
    // metrics
    overrides.metrics ?? [],
  ];

  const mockDb: any = {};
  const chain = () => {
    const idx = callIndex++;
    return {
      where: vi.fn((...args: any[]) => {
        whereCalls.push({ table: `query-${idx}`, args });
        const result = expectedResults[idx] ?? [];
        return Object.assign(Promise.resolve(result), {
          orderBy: vi.fn().mockReturnValue(
            Object.assign(Promise.resolve(result), {
              limit: vi.fn().mockResolvedValue(result),
            })
          ),
          limit: vi.fn().mockResolvedValue(result),
        });
      }),
    };
  };

  mockDb.select = vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => {
      const c = chain();
      return {
        where: c.where,
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            callIndex++; // consume one slot
            const idx = callIndex - 1;
            return Promise.resolve(expectedResults[idx] ?? []);
          }),
        }),
      };
    }),
  }));

  return { db: mockDb, whereCalls };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("post-scrape-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("afterKeywordScrape", () => {
    it("handles multiple tracked apps without SQL array interpolation error", async () => {
      const { db } = createMockDb({
        scrapeRunId: "run-123",
        trackedApps: [
          { appId: 2234230, appSlug: "app-a", appName: "App A" },
          { appId: 2235169, appSlug: "app-b", appName: "App B" },
          { appId: 2233282, appSlug: "app-c", appName: "App C" },
        ],
        currentRankings: [
          { appId: 2234230, keywordId: 1, position: 5 },
          { appId: 2235169, keywordId: 1, position: 10 },
        ],
        previousRankings: [],
        metrics: [],
      });

      // Should not throw — the old code would throw with
      // "invalid input syntax for type integer: '2234230,2235169,2233282'"
      await expect(
        afterKeywordScrape(db, "zoom", "job-1")
      ).resolves.toBeUndefined();
    });

    it("returns early when no scrape run found", async () => {
      const { db } = createMockDb({ scrapeRunId: undefined });

      await expect(
        afterKeywordScrape(db, "shopify", "missing-job")
      ).resolves.toBeUndefined();
    });

    it("returns early when no tracked apps exist", async () => {
      const { db } = createMockDb({
        scrapeRunId: "run-1",
        trackedApps: [],
      });

      await expect(
        afterKeywordScrape(db, "shopify", "job-1")
      ).resolves.toBeUndefined();
    });
  });

  describe("afterReviewScrape", () => {
    it("handles multiple new review IDs without SQL array interpolation error", async () => {
      const { db } = createMockDb({
        reviews: [
          { id: 100, rating: 5, reviewerName: "Alice", content: "Great", reviewDate: new Date() },
          { id: 101, rating: 4, reviewerName: "Bob", content: "Good", reviewDate: new Date() },
          { id: 102, rating: 3, reviewerName: "Charlie", content: "OK", reviewDate: new Date() },
        ],
      });

      // Override select chain for afterReviewScrape which has different query sequence
      let queryNum = 0;
      const reviewData = [
        { id: 100, rating: 5, reviewerName: "Alice", content: "Great", reviewDate: new Date() },
        { id: 101, rating: 4, reviewerName: "Bob", content: "Good", reviewDate: new Date() },
      ];
      db.select = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => {
            queryNum++;
            if (queryNum === 1) return Promise.resolve(reviewData);
            return Object.assign(Promise.resolve([]), {
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            });
          }),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        })),
      }));

      // Should not throw
      await expect(
        afterReviewScrape(db, "shopify", 1, "app-slug", "App Name", [100, 101, 102])
      ).resolves.toBeUndefined();
    });

    it("returns early when newReviewIds is empty", async () => {
      const { db } = createMockDb();

      await expect(
        afterReviewScrape(db, "shopify", 1, "app-slug", "App Name", [])
      ).resolves.toBeUndefined();
    });
  });

  describe("afterCategoryScrape", () => {
    it("handles multiple tracked apps without SQL array interpolation error", async () => {
      const { db } = createMockDb({
        scrapeRunId: "run-cat-1",
        trackedApps: [
          { appId: 100, appSlug: "app-x", appName: "App X" },
          { appId: 200, appSlug: "app-y", appName: "App Y" },
        ],
        currentCatRankings: [
          { appId: 100, categorySlug: "cat-a", position: 3 },
          { appId: 200, categorySlug: "cat-a", position: 7 },
        ],
        previousCatRankings: [],
      });

      await expect(
        afterCategoryScrape(db, "shopify", "job-cat-1")
      ).resolves.toBeUndefined();
    });

    it("returns early when no tracked apps exist", async () => {
      const { db } = createMockDb({
        scrapeRunId: "run-cat-2",
        trackedApps: [],
      });

      await expect(
        afterCategoryScrape(db, "shopify", "job-cat-2")
      ).resolves.toBeUndefined();
    });
  });

  describe("error resilience", () => {
    it("does not throw when DB query fails in afterKeywordScrape", async () => {
      const db: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockRejectedValue(new Error("DB connection lost")),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockRejectedValue(new Error("DB connection lost")),
            }),
          })),
        })),
      };

      // Should catch internally, not throw
      await expect(
        afterKeywordScrape(db, "shopify", "job-err")
      ).resolves.toBeUndefined();
    });

    it("does not throw when DB query fails in afterReviewScrape", async () => {
      const db: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockRejectedValue(new Error("DB error")),
          })),
        })),
      };

      await expect(
        afterReviewScrape(db, "shopify", 1, "slug", "Name", [1, 2, 3])
      ).resolves.toBeUndefined();
    });

    it("does not throw when DB query fails in afterCategoryScrape", async () => {
      const db: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockRejectedValue(new Error("DB error")),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockRejectedValue(new Error("DB error")),
            }),
          })),
        })),
      };

      await expect(
        afterCategoryScrape(db, "shopify", "job-err-2")
      ).resolves.toBeUndefined();
    });
  });

  describe("refreshDeveloperPlatformStats (PLA-1103)", () => {
    it("issues REFRESH MATERIALIZED VIEW CONCURRENTLY", async () => {
      const execute = vi.fn().mockResolvedValue([]);
      const db: any = { execute };

      await refreshDeveloperPlatformStats(db);

      expect(execute).toHaveBeenCalledTimes(1);
      // Inspect the SQL template passed to execute — drizzle wraps it in a
      // structured object; serialise and search for the key phrase.
      const call = execute.mock.calls[0][0];
      const serialised = JSON.stringify(call);
      expect(serialised).toContain("REFRESH MATERIALIZED VIEW CONCURRENTLY developer_platform_stats");
    });

    it("does not throw if refresh fails (post-scrape hook must be resilient)", async () => {
      const db: any = {
        execute: vi.fn().mockRejectedValue(new Error("MV missing")),
      };

      await expect(refreshDeveloperPlatformStats(db)).resolves.toBeUndefined();
    });
  });
});
