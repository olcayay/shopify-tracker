import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, adminToken, userToken, authHeaders } from "../helpers/test-app.js";

// Mock BullMQ Queue to avoid real Redis connections
const mockGetJobCounts = vi.fn();

vi.mock("bullmq", () => {
  class MockQueue {
    getJobCounts = mockGetJobCounts;
    add = vi.fn().mockResolvedValue({ id: "mock-job-1" });
    close = vi.fn().mockResolvedValue(undefined);
    isPaused = vi.fn().mockResolvedValue(false);
    pause = vi.fn().mockResolvedValue(undefined);
    resume = vi.fn().mockResolvedValue(undefined);
  }
  return { Queue: MockQueue };
});

describe("GET /api/system-admin/queue-stats", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { systemAdminRoutes } = await import("../../routes/system-admin.js");
    app = await buildTestApp({
      routes: systemAdminRoutes,
      prefix: "/api/system-admin",
      db: {
        selectResult: [],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 without a token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/queue-stats",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/queue-stats",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns queue counts for both queues", async () => {
    mockGetJobCounts
      .mockResolvedValueOnce({ waiting: 5, active: 2, completed: 100, failed: 3, delayed: 1 })
      .mockResolvedValueOnce({ waiting: 0, active: 1, completed: 50, failed: 0, delayed: 0 });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/queue-stats",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("background");
    expect(body).toHaveProperty("interactive");
    expect(body.background).toEqual({ waiting: 5, active: 2, completed: 100, failed: 3, delayed: 1 });
    expect(body.interactive).toEqual({ waiting: 0, active: 1, completed: 50, failed: 0, delayed: 0 });
  });

  it("returns zero counts when queues are empty", async () => {
    mockGetJobCounts
      .mockResolvedValueOnce({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 })
      .mockResolvedValueOnce({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/queue-stats",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.background.waiting).toBe(0);
    expect(body.background.active).toBe(0);
    expect(body.interactive.waiting).toBe(0);
  });
});
