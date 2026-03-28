import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, adminToken, userToken, authHeaders, createMockDb } from "../helpers/test-app.js";
import { dlqRoutes } from "../../routes/dlq.js";

// Mock BullMQ Queue to avoid real Redis connections
vi.mock("bullmq", () => {
  class MockQueue {
    add = vi.fn().mockResolvedValue({ id: "new-job-123" });
    close = vi.fn().mockResolvedValue(undefined);
  }
  return { Queue: MockQueue };
});

const sampleDlqJob = {
  id: 1,
  jobId: "job-abc-123",
  queueName: "background",
  jobType: "category",
  platform: "shopify",
  payload: { type: "category", platform: "shopify", triggeredBy: "scheduler" },
  errorMessage: "Timeout after 60s",
  errorStack: "Error: Timeout after 60s\n    at ...",
  attemptsMade: 2,
  failedAt: new Date("2026-03-28T10:00:00Z"),
  replayedAt: null,
  createdAt: new Date("2026-03-28T10:00:00Z"),
};

const replayedDlqJob = {
  ...sampleDlqJob,
  id: 2,
  replayedAt: new Date("2026-03-28T11:00:00Z"),
};

describe("DLQ Routes", () => {
  let app: FastifyInstance;
  let token: string;
  let normalUserToken: string;

  beforeAll(async () => {
    token = adminToken();
    normalUserToken = userToken();
    app = await buildTestApp({
      routes: dlqRoutes,
      prefix: "/api/system-admin/dlq",
      db: {
        selectResult: [sampleDlqJob],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/system-admin/dlq", () => {
    it("returns 403 for non-system-admin users", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/dlq",
        headers: authHeaders(normalUserToken),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 401 without auth header", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/dlq",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns dead letter jobs for system admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/dlq",
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("count");
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("accepts limit query parameter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/dlq?limit=10",
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(200);
    });

    it("accepts job_type filter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/dlq?job_type=category",
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(200);
    });

    it("accepts platform filter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/dlq?platform=shopify",
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/system-admin/dlq/:id/replay", () => {
    it("returns 403 for non-system-admin users", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/dlq/1/replay",
        headers: authHeaders(normalUserToken),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 for invalid ID", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/dlq/abc/replay",
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Invalid DLQ job ID");
    });

    it("returns 404 when job not found", async () => {
      // Build a fresh app with empty select results for this test
      const emptyApp = await buildTestApp({
        routes: dlqRoutes,
        prefix: "/api/system-admin/dlq",
        db: { selectResult: [] },
      });

      const res = await emptyApp.inject({
        method: "POST",
        url: "/api/system-admin/dlq/999/replay",
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("Dead letter job not found");
      await emptyApp.close();
    });

    it("returns 409 when job already replayed", async () => {
      const replayedApp = await buildTestApp({
        routes: dlqRoutes,
        prefix: "/api/system-admin/dlq",
        db: { selectResult: [replayedDlqJob] },
      });

      const res = await replayedApp.inject({
        method: "POST",
        url: "/api/system-admin/dlq/2/replay",
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toBe("Job has already been replayed");
      await replayedApp.close();
    });

    it("replays a dead letter job successfully", async () => {
      const replayApp = await buildTestApp({
        routes: dlqRoutes,
        prefix: "/api/system-admin/dlq",
        db: { selectResult: [sampleDlqJob] },
      });

      const res = await replayApp.inject({
        method: "POST",
        url: "/api/system-admin/dlq/1/replay",
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.message).toBe("Job replayed successfully");
      expect(body.newJobId).toBe("new-job-123");
      expect(body.dlqId).toBe(1);
      await replayApp.close();
    });
  });
});
