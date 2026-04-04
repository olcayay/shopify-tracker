import { describe, it, expect, afterEach, vi } from "vitest";
import { buildTestApp, adminToken, userToken, authHeaders, type MockDbOverrides } from "../helpers/test-app.js";
import { notificationHealthRoutes } from "../../routes/notification-health.js";
import type { FastifyInstance } from "fastify";

// Mock BullMQ Queue to avoid Redis connection
vi.mock("bullmq", () => {
  return {
    Queue: class MockQueue {
      async getJobCounts() {
        return { waiting: 5, active: 2, delayed: 1, failed: 0, completed: 100 };
      }
      async close() {}
    },
  };
});

async function buildApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  return buildTestApp({
    routes: notificationHealthRoutes,
    prefix: "/api/system-admin/notification-health",
    db,
  });
}

describe("GET /api/system-admin/notification-health", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns health overview with queue stats", async () => {
    app = await buildApp({
      executeResult: [{
        total: 50, read_count: 30, push_sent: 20,
        push_clicked: 10, push_dismissed: 5, push_errors: 2,
      }],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notification-health",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.timestamp).toBeDefined();
    expect(body.status).toBe("healthy");
    expect(body.queue).toBeDefined();
    expect(body.queue.waiting).toBe(5);
    expect(body.queue.active).toBe(2);
  });

  it("includes last24h delivery stats", async () => {
    app = await buildApp({
      executeResult: [{
        total: 100, read_count: 60, push_sent: 80,
        push_clicked: 40, push_dismissed: 10, push_errors: 3,
      }],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notification-health",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.last24h).toBeDefined();
    expect(body.last24h.total).toBe(100);
    expect(body.last24h.readCount).toBe(60);
    expect(body.last24h.pushSent).toBe(80);
  });

  it("returns 403 for non-admin users", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notification-health",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without auth", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notification-health",
    });

    expect(res.statusCode).toBe(401);
  });

  it("reports healthy status when metrics are normal", async () => {
    app = await buildApp({
      executeResult: [{
        total: 10, read_count: 5, push_sent: 8,
        push_clicked: 4, push_dismissed: 1, push_errors: 0,
      }],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notification-health",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("healthy");
  });
});
