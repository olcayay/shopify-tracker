import { describe, it, expect, afterEach } from "vitest";
import { buildTestApp, adminToken, userToken, authHeaders, type MockDbOverrides } from "../helpers/test-app.js";
import { notificationBroadcastRoutes } from "../../routes/notification-broadcast.js";
import type { FastifyInstance } from "fastify";

async function buildApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  return buildTestApp({
    routes: notificationBroadcastRoutes,
    prefix: "/api/system-admin/notifications",
    db,
  });
}

describe("POST /api/system-admin/notifications/broadcast/preview", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns recipient count for 'all' audience", async () => {
    app = await buildApp({ executeResult: [{ count: 42 }] });

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/notifications/broadcast/preview",
      headers: { ...authHeaders(adminToken()), "content-type": "application/json" },
      payload: { audience: "all" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.audience).toBe("all");
    expect(body.recipientCount).toBe(42);
  });

  it("returns 400 when audience is missing", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/notifications/broadcast/preview",
      headers: { ...authHeaders(adminToken()), "content-type": "application/json" },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("audience is required");
  });

  it("returns 403 for non-admin users", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/notifications/broadcast/preview",
      headers: { ...authHeaders(userToken()), "content-type": "application/json" },
      payload: { audience: "all" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without auth", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/notifications/broadcast/preview",
      headers: { "content-type": "application/json" },
      payload: { audience: "all" },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/system-admin/notifications/broadcast", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("sends broadcast to all users", async () => {
    app = await buildApp({
      executeResult: [
        { id: "u1", account_id: "a1" },
        { id: "u2", account_id: "a2" },
      ],
      insertResult: [],
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/notifications/broadcast",
      headers: { ...authHeaders(adminToken()), "content-type": "application/json" },
      payload: { title: "System Update", body: "New features available", audience: "all" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.message).toBe("Broadcast sent");
    expect(body.totalUsers).toBe(2);
    expect(body.inserted).toBe(2);
    expect(body.batchId).toMatch(/^broadcast-/);
    expect(body.status).toBe("sent");
  });

  it("returns 400 when required fields are missing", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/notifications/broadcast",
      headers: { ...authHeaders(adminToken()), "content-type": "application/json" },
      payload: { title: "Only title" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("title, body, and audience are required");
  });

  it("rejects scheduledAt in the past", async () => {
    app = await buildApp();

    const pastDate = new Date(Date.now() - 60000).toISOString();
    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/notifications/broadcast",
      headers: { ...authHeaders(adminToken()), "content-type": "application/json" },
      payload: { title: "Test", body: "Test body", audience: "all", scheduledAt: pastDate },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("scheduledAt must be in the future");
  });

  it("returns scheduled status when scheduledAt is provided", async () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    app = await buildApp({
      executeResult: [{ id: "u1", account_id: "a1" }],
      insertResult: [],
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/notifications/broadcast",
      headers: { ...authHeaders(adminToken()), "content-type": "application/json" },
      payload: { title: "Scheduled", body: "Scheduled body", audience: "all", scheduledAt: futureDate },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("scheduled");
  });

  it("returns 403 for non-admin users", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/notifications/broadcast",
      headers: { ...authHeaders(userToken()), "content-type": "application/json" },
      payload: { title: "Test", body: "Test", audience: "all" },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/system-admin/notifications/broadcasts", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns list of past broadcasts", async () => {
    const mockBroadcasts = [
      { batch_id: "broadcast-123", title: "Update", body: "New features", category: "system", recipient_count: 10, read_count: 5, created_at: new Date().toISOString() },
    ];
    app = await buildApp({ executeResult: mockBroadcasts });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notifications/broadcasts",
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
      url: "/api/system-admin/notifications/broadcasts",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("DELETE /api/system-admin/notifications/broadcast/:batchId", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("cancels a scheduled broadcast", async () => {
    app = await buildApp({ executeResult: { rowCount: 5 } });

    const res = await app.inject({
      method: "DELETE",
      url: "/api/system-admin/notifications/broadcast/broadcast-12345",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.batchId).toBe("broadcast-12345");
  });

  it("returns 403 for non-admin users", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "DELETE",
      url: "/api/system-admin/notifications/broadcast/broadcast-12345",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });
});
