import { describe, it, expect, afterEach } from "vitest";
import { buildTestApp, adminToken, userToken, authHeaders, type MockDbOverrides } from "../helpers/test-app.js";
import { notificationAnalyticsRoutes } from "../../routes/notification-analytics.js";
import type { FastifyInstance } from "fastify";

async function buildApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  return buildTestApp({
    routes: notificationAnalyticsRoutes,
    prefix: "/api/system-admin/notification-analytics",
    db,
  });
}

describe("GET /api/system-admin/notification-analytics/overview", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns overview stats for admin", async () => {
    app = await buildApp({
      executeResult: [{
        total: 500, read_count: 300, push_sent: 200,
        push_clicked: 80, push_dismissed: 40, archived: 50,
      }],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notification-analytics/overview",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.days).toBe(30);
    expect(body.total).toBe(500);
    expect(body.readCount).toBe(300);
    expect(body.readRate).toBe(60);
    expect(body.pushSent).toBe(200);
    expect(body.pushClicked).toBe(80);
    expect(body.pushClickRate).toBe(40);
    expect(body.archived).toBe(50);
  });

  it("respects custom days parameter", async () => {
    app = await buildApp({
      executeResult: [{ total: 100, read_count: 50, push_sent: 30, push_clicked: 10, push_dismissed: 5, archived: 10 }],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notification-analytics/overview?days=7",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().days).toBe(7);
  });

  it("clamps days to max 90", async () => {
    app = await buildApp({
      executeResult: [{ total: 0, read_count: 0, push_sent: 0, push_clicked: 0, push_dismissed: 0, archived: 0 }],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notification-analytics/overview?days=365",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().days).toBe(90);
  });

  it("returns 403 for non-admin users", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notification-analytics/overview",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without auth", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notification-analytics/overview",
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/system-admin/notification-analytics/trends", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns daily trend data", async () => {
    const mockTrends = [
      { date: "2026-04-01", total: 10, read_count: 5, push_sent: 3 },
      { date: "2026-04-02", total: 15, read_count: 8, push_sent: 6 },
    ];
    app = await buildApp({ executeResult: mockTrends });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notification-analytics/trends",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns 403 for non-admin users", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notification-analytics/trends",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/system-admin/notification-analytics/by-type", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns breakdown by type and category", async () => {
    const mockByType = [
      { type: "rank_change", category: "tracking", total: 100, read_count: 60, push_sent: 40, push_clicked: 20 },
      { type: "system_broadcast", category: "system", total: 50, read_count: 30, push_sent: 25, push_clicked: 15 },
    ];
    app = await buildApp({ executeResult: mockByType });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notification-analytics/by-type",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns 403 for non-admin users", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notification-analytics/by-type",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/system-admin/notification-analytics/push-adoption", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns push adoption stats", async () => {
    app = await buildApp({
      executeResult: [{
        users_with_push: 25, total_subscriptions: 30,
        active_subscriptions: 28, degraded: 2, count: 100,
      }],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notification-analytics/push-adoption",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalActiveUsers).toBeDefined();
    expect(body.usersWithPush).toBeDefined();
    expect(body.adoptionRate).toBeDefined();
    expect(body.totalSubscriptions).toBeDefined();
    expect(body.activeSubscriptions).toBeDefined();
    expect(body.degraded).toBeDefined();
  });

  it("returns 403 for non-admin users", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notification-analytics/push-adoption",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(403);
  });
});
