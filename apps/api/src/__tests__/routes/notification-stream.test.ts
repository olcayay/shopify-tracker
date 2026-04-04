import { describe, it, expect, afterEach } from "vitest";
import { buildTestApp, userToken, authHeaders, type MockDbOverrides } from "../helpers/test-app.js";
import { notificationStreamRoutes, groupNotifications, detectMilestones, getRetentionCutoff } from "../../routes/notification-stream.js";
import type { FastifyInstance } from "fastify";

async function buildApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  return buildTestApp({
    routes: notificationStreamRoutes,
    prefix: "/api/notifications",
    db,
  });
}

describe("GET /api/notifications/stream", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  // SSE endpoints write directly to raw response and keep the connection open,
  // so Fastify's inject() will hang waiting for the response to end.
  // We only test auth rejection (which completes immediately).

  it("returns 401 without auth", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications/stream",
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("groupNotifications()", () => {
  it("groups notifications by category", () => {
    const notifs = [
      { id: "1", category: "tracking", title: "Rank up", body: "App #1", createdAt: "2026-04-01T10:00:00Z" },
      { id: "2", category: "tracking", title: "Rank down", body: "App #2", createdAt: "2026-04-01T11:00:00Z" },
      { id: "3", category: "system", title: "Maintenance", body: null, createdAt: "2026-04-01T12:00:00Z" },
    ];

    const groups = groupNotifications(notifs);

    expect(groups).toHaveLength(2);
    const trackingGroup = groups.find(g => g.category === "tracking");
    expect(trackingGroup).toBeDefined();
    expect(trackingGroup!.count).toBe(2);
    expect(trackingGroup!.notifications).toHaveLength(2);
  });

  it("sorts groups by count descending", () => {
    const notifs = [
      { id: "1", category: "a", title: "A1", body: null, createdAt: "2026-04-01T10:00:00Z" },
      { id: "2", category: "b", title: "B1", body: null, createdAt: "2026-04-01T11:00:00Z" },
      { id: "3", category: "b", title: "B2", body: null, createdAt: "2026-04-01T12:00:00Z" },
      { id: "4", category: "b", title: "B3", body: null, createdAt: "2026-04-01T13:00:00Z" },
    ];

    const groups = groupNotifications(notifs);

    expect(groups[0].category).toBe("b");
    expect(groups[0].count).toBe(3);
    expect(groups[1].category).toBe("a");
    expect(groups[1].count).toBe(1);
  });

  it("returns empty array for empty input", () => {
    const groups = groupNotifications([]);
    expect(groups).toEqual([]);
  });

  it("sets latestTitle and latestBody from first notification in category", () => {
    const notifs = [
      { id: "1", category: "alerts", title: "First Alert", body: "First body", createdAt: "2026-04-01T10:00:00Z" },
      { id: "2", category: "alerts", title: "Second Alert", body: "Second body", createdAt: "2026-04-01T11:00:00Z" },
    ];

    const groups = groupNotifications(notifs);
    expect(groups[0].latestTitle).toBe("First Alert");
    expect(groups[0].latestBody).toBe("First body");
  });
});

describe("detectMilestones()", () => {
  it("detects when a threshold is crossed", () => {
    expect(detectMilestones(100, 99)).toBe(100);
    expect(detectMilestones(50, 49)).toBe(50);
    expect(detectMilestones(10, 9)).toBe(10);
  });

  it("returns null when no threshold crossed", () => {
    expect(detectMilestones(15, 14)).toBeNull();
    expect(detectMilestones(99, 98)).toBeNull();
  });

  it("returns null when going backwards", () => {
    expect(detectMilestones(99, 100)).toBeNull();
  });

  it("detects the first threshold crossed", () => {
    // Jumps from 8 to 30 — crosses both 10 and 25, should return 10 (first)
    expect(detectMilestones(30, 8)).toBe(10);
  });

  it("works with custom thresholds", () => {
    expect(detectMilestones(75, 60, [25, 50, 75, 100])).toBe(75);
    expect(detectMilestones(40, 30, [25, 50, 75, 100])).toBeNull();
  });

  it("returns null when both values exceed all thresholds", () => {
    expect(detectMilestones(15000, 12000)).toBeNull();
  });
});

describe("getRetentionCutoff()", () => {
  it("returns date 90 days ago by default", () => {
    const cutoff = getRetentionCutoff();
    const expected = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    // Allow 1 second tolerance
    expect(Math.abs(cutoff.getTime() - expected.getTime())).toBeLessThan(1000);
  });

  it("respects custom retention days", () => {
    const cutoff = getRetentionCutoff(30);
    const expected = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    expect(Math.abs(cutoff.getTime() - expected.getTime())).toBeLessThan(1000);
  });
});
