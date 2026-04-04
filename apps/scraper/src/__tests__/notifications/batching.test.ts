import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  shouldBatch,
  configureBatching,
  flushAllBatches,
  getBatchStats,
  _resetBatching,
} from "../../notifications/batching.js";
import type { NotificationJobData } from "@appranks/shared";

function makeEvent(overrides: Partial<NotificationJobData> = {}): NotificationJobData {
  return {
    type: "notification_ranking_change" as any,
    userId: "u1",
    accountId: "a1",
    payload: { appName: "TestApp", eventType: "ranking_top3_entry" },
    createdAt: new Date().toISOString(),
    sendPush: true,
    ...overrides,
  };
}

describe("Notification Batching Engine", () => {
  beforeEach(() => {
    _resetBatching();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("batches ranking events for the same user", () => {
    configureBatching({ windowMs: 5000, mergeThreshold: 3 });

    expect(shouldBatch(makeEvent())).toBe(true);
    expect(shouldBatch(makeEvent())).toBe(true);

    const stats = getBatchStats();
    expect(stats.activeBatches).toBe(1);
    expect(stats.totalPendingEvents).toBe(2);
  });

  it("does not batch urgent types (milestones)", () => {
    configureBatching({ windowMs: 5000, mergeThreshold: 3 });

    const result = shouldBatch(makeEvent({ type: "notification_milestone" as any }));
    expect(result).toBe(false);
  });

  it("does not batch unknown types", () => {
    configureBatching({ windowMs: 5000, mergeThreshold: 3 });

    const result = shouldBatch(makeEvent({ type: "unknown_type" as any }));
    expect(result).toBe(false);
  });

  it("keeps separate batches per user", () => {
    configureBatching({ windowMs: 5000, mergeThreshold: 3 });

    shouldBatch(makeEvent({ userId: "u1" }));
    shouldBatch(makeEvent({ userId: "u2" }));

    const stats = getBatchStats();
    expect(stats.activeBatches).toBe(2);
  });

  it("keeps separate batches per category", () => {
    configureBatching({ windowMs: 5000, mergeThreshold: 3 });

    shouldBatch(makeEvent({ type: "notification_ranking_change" as any }));
    shouldBatch(makeEvent({ type: "notification_new_review" as any }));

    const stats = getBatchStats();
    expect(stats.activeBatches).toBe(2);
  });

  it("flushes merged notification when threshold met", async () => {
    const flushed: { events: NotificationJobData[]; merged: NotificationJobData }[] = [];

    configureBatching(
      { windowMs: 1000, mergeThreshold: 3 },
      async (events, merged) => {
        flushed.push({ events, merged });
      }
    );

    shouldBatch(makeEvent({ payload: { appName: "App1" } }));
    shouldBatch(makeEvent({ payload: { appName: "App2" } }));
    shouldBatch(makeEvent({ payload: { appName: "App3" } }));

    // Advance timer to trigger flush
    vi.advanceTimersByTime(1100);

    // Allow async flush to complete
    await vi.runAllTimersAsync();

    expect(flushed).toHaveLength(1);
    expect(flushed[0].events).toHaveLength(3);
    expect(flushed[0].merged.payload.isBatched).toBe(true);
    expect(flushed[0].merged.payload.batchCount).toBe(3);
  });

  it("flushes individually when below threshold", async () => {
    const flushed: { events: NotificationJobData[]; merged: NotificationJobData }[] = [];

    configureBatching(
      { windowMs: 1000, mergeThreshold: 3 },
      async (events, merged) => {
        flushed.push({ events, merged });
      }
    );

    shouldBatch(makeEvent());
    shouldBatch(makeEvent());

    vi.advanceTimersByTime(1100);
    await vi.runAllTimersAsync();

    // Below threshold — each sent individually
    expect(flushed).toHaveLength(2);
    expect(flushed[0].events).toHaveLength(1);
  });

  it("flushAllBatches flushes everything", async () => {
    const flushed: NotificationJobData[] = [];

    configureBatching(
      { windowMs: 60000, mergeThreshold: 10 },
      async (_events, merged) => {
        flushed.push(merged);
      }
    );

    shouldBatch(makeEvent({ userId: "u1" }));
    shouldBatch(makeEvent({ userId: "u2" }));

    const count = await flushAllBatches();
    expect(count).toBe(2);
    expect(getBatchStats().activeBatches).toBe(0);
  });

  it("merged notification includes unique app names", async () => {
    const flushed: NotificationJobData[] = [];

    configureBatching(
      { windowMs: 1000, mergeThreshold: 2 },
      async (_events, merged) => {
        flushed.push(merged);
      }
    );

    shouldBatch(makeEvent({ payload: { appName: "App1", eventType: "ranking_top3_entry" } }));
    shouldBatch(makeEvent({ payload: { appName: "App2", eventType: "ranking_dropped_out" } }));
    shouldBatch(makeEvent({ payload: { appName: "App1", eventType: "ranking_new_entry" } }));

    vi.advanceTimersByTime(1100);
    await vi.runAllTimersAsync();

    expect(flushed).toHaveLength(1);
    const merged = flushed[0];
    expect(merged.payload.appNames).toEqual(["App1", "App2"]);
    expect(merged.payload.appName).toBe("App1 and 1 more");
  });
});
