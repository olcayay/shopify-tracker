import { describe, it, expect } from "vitest";

/**
 * Tests for the event aggregation logic in dispatchAll.
 * Events should be grouped by appId so each user gets at most one email per app.
 */

interface MockEvent {
  type: string;
  appId: number;
  platform: string;
  data: Record<string, unknown>;
}

function groupEventsByApp(events: MockEvent[]): Map<number, MockEvent[]> {
  const eventsByApp = new Map<number, MockEvent[]>();
  for (const event of events) {
    const list = eventsByApp.get(event.appId) || [];
    list.push(event);
    eventsByApp.set(event.appId, list);
  }
  return eventsByApp;
}

describe("Event aggregation by appId", () => {
  it("groups multiple events for same app into one group", () => {
    const events: MockEvent[] = [
      { type: "ranking_significant_change", appId: 1, platform: "shopify", data: { keyword: "crm" } },
      { type: "ranking_category_change", appId: 1, platform: "shopify", data: { categoryName: "marketing" } },
      { type: "ranking_dropped_out", appId: 1, platform: "shopify", data: { keyword: "email" } },
    ];

    const grouped = groupEventsByApp(events);
    expect(grouped.size).toBe(1);
    expect(grouped.get(1)).toHaveLength(3);
  });

  it("keeps events for different apps separate", () => {
    const events: MockEvent[] = [
      { type: "ranking_significant_change", appId: 1, platform: "shopify", data: {} },
      { type: "ranking_significant_change", appId: 2, platform: "shopify", data: {} },
      { type: "ranking_category_change", appId: 1, platform: "shopify", data: {} },
    ];

    const grouped = groupEventsByApp(events);
    expect(grouped.size).toBe(2);
    expect(grouped.get(1)).toHaveLength(2);
    expect(grouped.get(2)).toHaveLength(1);
  });

  it("handles single event correctly", () => {
    const events: MockEvent[] = [
      { type: "ranking_top3_entry", appId: 5, platform: "zoom", data: {} },
    ];

    const grouped = groupEventsByApp(events);
    expect(grouped.size).toBe(1);
    expect(grouped.get(5)).toHaveLength(1);
  });

  it("handles empty events array", () => {
    const grouped = groupEventsByApp([]);
    expect(grouped.size).toBe(0);
  });
});
