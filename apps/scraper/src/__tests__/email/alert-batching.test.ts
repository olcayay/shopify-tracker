import { describe, it, expect, beforeEach } from "vitest";
import {
  addToBatch,
  flushBatch,
  flushAllBatches,
  getPendingCount,
  clearAllBuffers,
  isQuietHours,
  type AlertEvent,
} from "../../email/alert-batching.js";

function makeEvent(overrides: Partial<AlertEvent> = {}): AlertEvent {
  return {
    userId: "user-1",
    accountId: "acc-1",
    type: "ranking_significant_change",
    category: "ranking",
    title: "Ranking changed",
    body: "Position changed",
    eventData: {},
    timestamp: new Date(),
    ...overrides,
  };
}

describe("alert batching", () => {
  beforeEach(() => clearAllBuffers());

  it("buffers events below threshold", () => {
    const result = addToBatch(makeEvent());
    expect(result).toBeNull();
    expect(getPendingCount("user-1", "ranking")).toBe(1);
  });

  it("returns batched alert when threshold exceeded", () => {
    addToBatch(makeEvent());
    addToBatch(makeEvent());
    addToBatch(makeEvent());
    const result = addToBatch(makeEvent()); // 4th event triggers batch

    expect(result).not.toBeNull();
    expect(result!.events.length).toBe(4);
    expect(result!.mergedTitle).toContain("4 Ranking updates");
    expect(getPendingCount("user-1", "ranking")).toBe(0);
  });

  it("keeps different categories separate", () => {
    addToBatch(makeEvent({ category: "ranking" }));
    addToBatch(makeEvent({ category: "ranking" }));
    addToBatch(makeEvent({ category: "review" }));

    expect(getPendingCount("user-1", "ranking")).toBe(2);
    expect(getPendingCount("user-1", "review")).toBe(1);
  });

  it("keeps different users separate", () => {
    addToBatch(makeEvent({ userId: "user-1" }));
    addToBatch(makeEvent({ userId: "user-2" }));

    expect(getPendingCount("user-1", "ranking")).toBe(1);
    expect(getPendingCount("user-2", "ranking")).toBe(1);
  });

  it("flushAllBatches returns all pending batches above threshold", () => {
    // Add 4 events for one user (above threshold)
    for (let i = 0; i < 4; i++) addToBatch(makeEvent());
    // Buffer is already flushed by the 4th addToBatch
    // So flushAllBatches should return empty
    const results = flushAllBatches();
    expect(results.length).toBe(0);
  });

  it("flushBatch returns null for unknown key", () => {
    expect(flushBatch("nonexistent:key")).toBeNull();
  });
});

describe("isQuietHours", () => {
  it("returns true at 11 PM local time", () => {
    // 23:00 Istanbul = 20:00 UTC
    const now = new Date("2026-03-29T20:00:00Z");
    expect(isQuietHours(now, "Europe/Istanbul")).toBe(true);
  });

  it("returns true at 3 AM local time", () => {
    // 03:00 Istanbul = 00:00 UTC
    const now = new Date("2026-03-29T00:00:00Z");
    expect(isQuietHours(now, "Europe/Istanbul")).toBe(true);
  });

  it("returns false at 8 AM local time", () => {
    // 08:00 Istanbul = 05:00 UTC
    const now = new Date("2026-03-29T05:00:00Z");
    expect(isQuietHours(now, "Europe/Istanbul")).toBe(false);
  });

  it("returns false at 2 PM local time", () => {
    // 14:00 Istanbul = 11:00 UTC
    const now = new Date("2026-03-29T11:00:00Z");
    expect(isQuietHours(now, "Europe/Istanbul")).toBe(false);
  });
});
