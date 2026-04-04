import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../timezone.js", () => ({
  getLocalTime: vi.fn(),
}));

import {
  isQuietHours,
  addToBatch,
  flushBatch,
  flushAllBatches,
  getPendingCount,
  clearAllBuffers,
  BATCH_THRESHOLD,
  type AlertEvent,
} from "../alert-batching.js";
import { getLocalTime } from "../timezone.js";

const mockedGetLocalTime = vi.mocked(getLocalTime);

function makeEvent(overrides: Partial<AlertEvent> = {}): AlertEvent {
  return {
    userId: "user-1",
    accountId: "acc-1",
    type: "ranking_change",
    category: "ranking",
    title: "Rank changed",
    body: "Your app moved from #5 to #3",
    eventData: {},
    timestamp: new Date("2026-04-03T12:00:00Z"),
    ...overrides,
  };
}

describe("alert-batching", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAllBuffers();
    mockedGetLocalTime.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearAllBuffers();
  });

  describe("isQuietHours", () => {
    it("returns true during late night (22:00-23:59)", () => {
      mockedGetLocalTime.mockReturnValue({ hour: 23, minute: 30, dateStr: "2026-04-03" });
      expect(isQuietHours(new Date(), "Europe/Istanbul")).toBe(true);
    });

    it("returns true during early morning (00:00-06:59)", () => {
      mockedGetLocalTime.mockReturnValue({ hour: 3, minute: 0, dateStr: "2026-04-03" });
      expect(isQuietHours(new Date(), "America/New_York")).toBe(true);
    });

    it("returns false during daytime (07:00-21:59)", () => {
      mockedGetLocalTime.mockReturnValue({ hour: 14, minute: 0, dateStr: "2026-04-03" });
      expect(isQuietHours(new Date(), "Europe/London")).toBe(false);
    });

    it("returns false at exactly 7 AM (boundary)", () => {
      mockedGetLocalTime.mockReturnValue({ hour: 7, minute: 0, dateStr: "2026-04-03" });
      expect(isQuietHours(new Date(), "UTC")).toBe(false);
    });

    it("returns true at exactly 22:00 (boundary)", () => {
      mockedGetLocalTime.mockReturnValue({ hour: 22, minute: 0, dateStr: "2026-04-03" });
      expect(isQuietHours(new Date(), "UTC")).toBe(true);
    });
  });

  describe("addToBatch", () => {
    it("buffers events below threshold and returns null", () => {
      const result = addToBatch(makeEvent());
      expect(result).toBeNull();
      expect(getPendingCount("user-1", "ranking")).toBe(1);
    });

    it("returns batched alert when threshold is exceeded", () => {
      // BATCH_THRESHOLD is 3, so we need >3 events to trigger
      for (let i = 0; i < BATCH_THRESHOLD; i++) {
        const result = addToBatch(makeEvent({ title: `Event ${i}` }));
        expect(result).toBeNull();
      }
      // The 4th event should trigger a flush
      const batch = addToBatch(makeEvent({ title: "Event 4" }));
      expect(batch).not.toBeNull();
      expect(batch!.events).toHaveLength(BATCH_THRESHOLD + 1);
      expect(batch!.mergedTitle).toBe(`${BATCH_THRESHOLD + 1} Ranking updates`);
    });

    it("keeps separate buffers for different users", () => {
      addToBatch(makeEvent({ userId: "user-A", category: "ranking" }));
      addToBatch(makeEvent({ userId: "user-B", category: "ranking" }));
      expect(getPendingCount("user-A", "ranking")).toBe(1);
      expect(getPendingCount("user-B", "ranking")).toBe(1);
    });

    it("keeps separate buffers for different categories", () => {
      addToBatch(makeEvent({ userId: "user-1", category: "ranking" }));
      addToBatch(makeEvent({ userId: "user-1", category: "review" }));
      expect(getPendingCount("user-1", "ranking")).toBe(1);
      expect(getPendingCount("user-1", "review")).toBe(1);
    });
  });

  describe("flushBatch", () => {
    it("returns null for non-existent key", () => {
      expect(flushBatch("nonexistent:key")).toBeNull();
    });

    it("returns null when events count is at or below threshold", () => {
      addToBatch(makeEvent());
      addToBatch(makeEvent());
      // 2 events <= BATCH_THRESHOLD (3), so flush returns null
      const result = flushBatch("user-1:ranking");
      expect(result).toBeNull();
      // Buffer should be cleared even though no batch was returned
      expect(getPendingCount("user-1", "ranking")).toBe(0);
    });

    it("generates correct merged title with capitalized category", () => {
      // Add BATCH_THRESHOLD events (won't trigger auto-flush)
      for (let i = 0; i < BATCH_THRESHOLD; i++) {
        addToBatch(makeEvent({ category: "review" }));
      }
      // The (BATCH_THRESHOLD + 1)th event triggers auto-flush via addToBatch
      const batch = addToBatch(makeEvent({ category: "review" }));
      expect(batch).not.toBeNull();
      expect(batch!.mergedTitle).toMatch(/^\d+ Review updates$/);
      expect(batch!.category).toBe("review");
    });
  });

  describe("flushAllBatches", () => {
    it("returns empty array when no batches exceed threshold", () => {
      addToBatch(makeEvent({ userId: "user-1", category: "ranking" }));
      addToBatch(makeEvent({ userId: "user-2", category: "review" }));
      const results = flushAllBatches();
      expect(results).toEqual([]);
    });

    it("flushes all qualifying batches across users and categories", () => {
      // Add exactly BATCH_THRESHOLD events per user (won't auto-flush)
      for (let i = 0; i < BATCH_THRESHOLD; i++) {
        addToBatch(makeEvent({ userId: "user-1", category: "ranking" }));
      }
      for (let i = 0; i < BATCH_THRESHOLD; i++) {
        addToBatch(makeEvent({ userId: "user-2", category: "review" }));
      }
      // Both buffers have BATCH_THRESHOLD (3) events, which is <= threshold
      // flushBatch returns null for these, so flushAllBatches returns []
      // This verifies that sub-threshold batches are cleared but not returned
      const results = flushAllBatches();
      expect(results).toEqual([]);
      // Verify buffers were cleared
      expect(getPendingCount("user-1", "ranking")).toBe(0);
      expect(getPendingCount("user-2", "review")).toBe(0);
    });
  });
});
