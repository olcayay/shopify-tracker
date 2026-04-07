import { describe, it, expect } from "vitest";

/**
 * Tests for the previous rankings deduplication logic in post-scrape-events.ts.
 * The logic ensures only the newest entry per keywordId/categorySlug is kept
 * when building the previous rankings map.
 */

describe("Previous rankings deduplication", () => {
  describe("keyword rankings (prevByApp)", () => {
    it("keeps only the newest entry per keywordId when duplicates exist", () => {
      // Simulate allPreviousRankings ordered by scrapedAt DESC (newest first)
      const allPreviousRankings = [
        { appId: 1, keywordId: 10, position: 5 },   // newest for kw 10
        { appId: 1, keywordId: 20, position: 3 },   // newest for kw 20
        { appId: 1, keywordId: 10, position: 260 },  // older duplicate for kw 10
        { appId: 1, keywordId: 10, position: 255 },  // oldest duplicate for kw 10
        { appId: 1, keywordId: 20, position: 50 },   // older duplicate for kw 20
      ];

      const prevByApp = new Map<number, any[]>();
      for (const r of allPreviousRankings) {
        const list = prevByApp.get(r.appId) || [];
        if (!list.some((existing) => existing.keywordId === r.keywordId)) {
          list.push(r);
        }
        prevByApp.set(r.appId, list);
      }

      const app1Prev = prevByApp.get(1)!;
      expect(app1Prev).toHaveLength(2); // Only 2 unique keywords
      expect(app1Prev[0]).toEqual({ appId: 1, keywordId: 10, position: 5 });
      expect(app1Prev[1]).toEqual({ appId: 1, keywordId: 20, position: 3 });
    });

    it("handles multiple apps correctly", () => {
      const allPreviousRankings = [
        { appId: 1, keywordId: 10, position: 5 },
        { appId: 2, keywordId: 10, position: 8 },
        { appId: 1, keywordId: 10, position: 100 }, // duplicate for app1
        { appId: 2, keywordId: 10, position: 200 }, // duplicate for app2
      ];

      const prevByApp = new Map<number, any[]>();
      for (const r of allPreviousRankings) {
        const list = prevByApp.get(r.appId) || [];
        if (!list.some((existing) => existing.keywordId === r.keywordId)) {
          list.push(r);
        }
        prevByApp.set(r.appId, list);
      }

      expect(prevByApp.get(1)).toHaveLength(1);
      expect(prevByApp.get(1)![0].position).toBe(5);
      expect(prevByApp.get(2)).toHaveLength(1);
      expect(prevByApp.get(2)![0].position).toBe(8);
    });

    it("without dedup, old Map constructor would keep oldest entry (the bug)", () => {
      // This test documents the original bug:
      // new Map(array.map(r => [r.keywordId, r])) keeps the LAST (oldest) entry
      const previous = [
        { keywordId: 10, position: 5 },   // newest — should win
        { keywordId: 10, position: 260 },  // oldest — was winning (bug)
      ];

      // Bug behavior: Map constructor overwrites, keeping last
      const bugMap = new Map(previous.map((r) => [r.keywordId, r]));
      expect(bugMap.get(10)!.position).toBe(260); // BUG: oldest wins

      // Fixed behavior: first-seen wins (newest due to DESC order)
      const fixedList: any[] = [];
      for (const r of previous) {
        if (!fixedList.some((e) => e.keywordId === r.keywordId)) {
          fixedList.push(r);
        }
      }
      expect(fixedList[0].position).toBe(5); // FIXED: newest wins
    });
  });

  describe("category rankings (prevCatByApp)", () => {
    it("keeps only the newest entry per categorySlug when duplicates exist", () => {
      const allPrevCat = [
        { appId: 1, categorySlug: "marketing", position: 3 },   // newest
        { appId: 1, categorySlug: "analytics", position: 7 },   // newest
        { appId: 1, categorySlug: "marketing", position: 250 }, // old duplicate
      ];

      const prevCatByApp = new Map<number, any[]>();
      for (const r of allPrevCat) {
        const list = prevCatByApp.get(r.appId) || [];
        if (!list.some((existing) => existing.categorySlug === r.categorySlug)) {
          list.push(r);
        }
        prevCatByApp.set(r.appId, list);
      }

      const app1Prev = prevCatByApp.get(1)!;
      expect(app1Prev).toHaveLength(2);
      expect(app1Prev[0].position).toBe(3);
      expect(app1Prev[1].position).toBe(7);
    });
  });
});
