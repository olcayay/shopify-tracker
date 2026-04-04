import { describe, it, expect, afterEach } from "vitest";
import { buildTestApp, adminToken, userToken, authHeaders, type MockDbOverrides } from "../helpers/test-app.js";
import { adminNotificationRoutes } from "../../routes/admin-notifications.js";
import type { FastifyInstance } from "fastify";

async function buildApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  return buildTestApp({
    routes: adminNotificationRoutes,
    prefix: "/api/system-admin",
    db,
  });
}

describe("GET /api/system-admin/notifications/stats", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns aggregate notification stats for admin", async () => {
    app = await buildApp({
      executeResult: [{
        total: "200", read_count: "150", push_sent: "100",
        push_clicked: "40", failed: "5", last_24h: "20", last_7d: "80",
      }],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notifications/stats",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(200);
    expect(body.readCount).toBe(150);
    expect(body.readRate).toBe(75);
    expect(body.pushSent).toBe(100);
    expect(body.pushClicked).toBe(40);
    expect(body.pushClickRate).toBe(40);
    expect(body.failed).toBe(5);
    expect(body.last24h).toBe(20);
    expect(body.last7d).toBe(80);
  });

  it("handles zero totals without division errors", async () => {
    app = await buildApp({
      executeResult: [{
        total: "0", read_count: "0", push_sent: "0",
        push_clicked: "0", failed: "0", last_24h: "0", last_7d: "0",
      }],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notifications/stats",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.readRate).toBe(0);
    expect(body.pushClickRate).toBe(0);
  });

  it("returns 403 for non-admin users", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notifications/stats",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without auth", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notifications/stats",
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/system-admin/notifications", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns paginated notification list", async () => {
    const mockNotifs = [
      { id: "n1", type: "rank_change", category: "tracking", userId: "u1", title: "Rank changed", isRead: false, pushSent: true, pushClicked: false, priority: "normal", createdAt: new Date() },
    ];
    app = await buildApp({ selectResult: mockNotifs });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notifications?limit=10&offset=0",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.notifications).toBeDefined();
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(0);
  });

  it("clamps limit to max 200", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notifications?limit=500",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().limit).toBe(200);
  });

  it("defaults limit=50 and offset=0", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notifications",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);
  });

  it("returns 403 for non-admin users", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notifications",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/system-admin/notifications/:id", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns notification with delivery logs", async () => {
    const mockNotif = { id: "n1", type: "rank_change", title: "Rank up", body: "App moved up", createdAt: new Date() };
    app = await buildApp({ selectResult: [mockNotif] });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notifications/n1",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.notification).toBeDefined();
    expect(body.deliveryLogs).toBeDefined();
  });

  it("returns 404 when notification not found", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notifications/nonexistent",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Notification not found");
  });

  it("returns 403 for non-admin users", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notifications/n1",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/system-admin/notifications/retention", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns retention stats", async () => {
    app = await buildApp({
      executeResult: [{ total: "500", expired: "50" }],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notifications/retention",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.retentionDays).toBe(90);
    expect(body.cutoffDate).toBeDefined();
    expect(body.totalNotifications).toBe(500);
    expect(body.expiredNotifications).toBe(50);
  });

  it("returns 403 for non-admin users", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notifications/retention",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(403);
  });
});
