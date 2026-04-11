import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  buildTestApp,
  userToken,
  adminToken,
  viewerToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";

// Mock BullMQ Queue to avoid real Redis connections in CI
vi.mock("bullmq", () => {
  class MockQueue {
    add = vi.fn().mockResolvedValue({ id: "mock-job-1" });
    close = vi.fn().mockResolvedValue(undefined);
    getJobCounts = vi.fn().mockResolvedValue({});
    isPaused = vi.fn().mockResolvedValue(false);
    pause = vi.fn().mockResolvedValue(undefined);
    resume = vi.fn().mockResolvedValue(undefined);
  }
  return { Queue: MockQueue };
});

const MOCK_UPDATE = {
  id: 1,
  appName: "Test App",
  appSlug: "test-app",
  platform: "shopify",
  field: "name",
  oldValue: "Old Name",
  newValue: "New Name",
  detectedAt: "2026-04-10T12:00:00Z",
  changeId: 1,
  labelId: 1,
  labelName: "false-positive",
  labelColor: "#ef4444",
  count: 1,
  name: "false-positive",
  color: "#ef4444",
};

describe("GET /api/system-admin/app-updates", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { systemAdminRoutes } = await import("../../routes/system-admin.js");
    app = await buildTestApp({
      routes: systemAdminRoutes,
      prefix: "/api/system-admin",
      db: {
        selectResult: [MOCK_UPDATE],
        insertResult: [{ id: 1, name: "test-label", color: "#3b82f6", createdAt: new Date().toISOString() }],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // -----------------------------------------------------------------------
  // Auth enforcement
  // -----------------------------------------------------------------------

  it("returns 401 without any token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 403 for viewer", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates",
      headers: authHeaders(viewerToken()),
    });
    expect(res.statusCode).toBe(403);
  });

  // -----------------------------------------------------------------------
  // Successful requests
  // -----------------------------------------------------------------------

  it("returns 200 with data, pagination, and filters (including labels)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("pagination");
    expect(body).toHaveProperty("filters");
    expect(body.pagination).toHaveProperty("page");
    expect(body.pagination).toHaveProperty("limit");
    expect(body.pagination).toHaveProperty("total");
    expect(body.pagination).toHaveProperty("totalPages");
    expect(body.filters).toHaveProperty("fields");
    expect(body.filters).toHaveProperty("platforms");
    expect(body.filters).toHaveProperty("labels");
  });

  it("each data row includes labels array", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates",
      headers: authHeaders(adminToken()),
    });
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    if (body.data.length > 0) {
      expect(body.data[0]).toHaveProperty("labels");
      expect(Array.isArray(body.data[0].labels)).toBe(true);
    }
  });

  it("accepts page and limit query params", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates?page=2&limit=25",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.pagination.page).toBe(2);
    expect(body.pagination.limit).toBe(25);
  });

  it("clamps limit to max 200", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates?limit=500",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().pagination.limit).toBe(200);
  });

  it("clamps limit minimum to 1", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates?limit=0",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().pagination.limit).toBe(1);
  });

  it("defaults page to 1 if negative", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates?page=-5",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().pagination.page).toBe(1);
  });

  it("accepts platform filter", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates?platform=shopify",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
  });

  it("accepts field filter", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates?field=name",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
  });

  it("accepts search parameter", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates?search=jotform",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
  });

  it("accepts date range filters", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates?dateFrom=2026-04-01&dateTo=2026-04-10",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
  });

  it("accepts sortOrder=asc", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates?sortOrder=asc",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
  });

  it("accepts labelId filter", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates?labelId=1",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
  });

  it("accepts all filters combined", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates?platform=shopify&field=name&search=test&dateFrom=2026-04-01&dateTo=2026-04-10&sortOrder=asc&page=1&limit=10&labelId=1",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(10);
  });
});

// -----------------------------------------------------------------------
// Label CRUD endpoints
// -----------------------------------------------------------------------

describe("App Update Labels CRUD", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { systemAdminRoutes } = await import("../../routes/system-admin.js");
    app = await buildTestApp({
      routes: systemAdminRoutes,
      prefix: "/api/system-admin",
      db: {
        selectResult: [{ id: 1, name: "false-positive", color: "#ef4444", createdAt: "2026-04-10T00:00:00Z" }],
        insertResult: [{ id: 2, name: "verified", color: "#22c55e", createdAt: "2026-04-10T00:00:00Z", changeId: 1, labelId: 2 }],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /app-update-labels returns 200 for admin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-update-labels",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
  });

  it("GET /app-update-labels returns 403 for non-admin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-update-labels",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(403);
  });

  it("POST /app-update-labels creates a label", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/app-update-labels",
      headers: { ...authHeaders(adminToken()), "content-type": "application/json" },
      body: JSON.stringify({ name: "verified", color: "#22c55e" }),
    });
    expect(res.statusCode).toBe(201);
  });

  it("POST /app-update-labels returns 400 without name", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/app-update-labels",
      headers: { ...authHeaders(adminToken()), "content-type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    expect(res.statusCode).toBe(400);
  });

  it("DELETE /app-update-labels/:id returns 204 for admin", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/system-admin/app-update-labels/1",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(204);
  });

  it("POST /app-updates/:changeId/labels assigns a label", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/app-updates/1/labels",
      headers: { ...authHeaders(adminToken()), "content-type": "application/json" },
      body: JSON.stringify({ labelId: 1 }),
    });
    expect(res.statusCode).toBe(201);
  });

  it("POST /app-updates/:changeId/labels returns 400 without labelId", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/app-updates/1/labels",
      headers: { ...authHeaders(adminToken()), "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.statusCode).toBe(400);
  });

  it("DELETE /app-updates/:changeId/labels/:labelId returns 204", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/system-admin/app-updates/1/labels/1",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(204);
  });
});
