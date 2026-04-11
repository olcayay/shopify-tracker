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
  count: 1,
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

  it("returns 200 with data for system admin", async () => {
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
    const body = res.json();
    expect(body.pagination.limit).toBe(200);
  });

  it("clamps limit minimum to 1", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates?limit=0",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.pagination.limit).toBe(1);
  });

  it("defaults page to 1 if negative", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates?page=-5",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.pagination.page).toBe(1);
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

  it("defaults sortOrder to desc for invalid values", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates?sortOrder=invalid",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
  });

  it("accepts all filters combined", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/app-updates?platform=shopify&field=name&search=test&dateFrom=2026-04-01&dateTo=2026-04-10&sortOrder=asc&page=1&limit=10",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(10);
  });
});
