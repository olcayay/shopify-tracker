import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  buildTestApp,
  createMockDb,
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
  }
  return { Queue: MockQueue };
});

describe("System admin routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { systemAdminRoutes } = await import("../../routes/system-admin.js");
    app = await buildTestApp({
      routes: systemAdminRoutes,
      prefix: "/api/system-admin",
      db: {
        selectResult: [
          {
            id: "account-001",
            name: "Test Account",
            packageId: null,
            isSuspended: false,
            maxTrackedApps: 10,
            maxTrackedKeywords: 50,
            maxCompetitorApps: 20,
            maxTrackedFeatures: 10,
            maxUsers: 5,
            maxResearchProjects: 3,
            count: 0,
            email: "admin@test.com",
            role: "owner",
            isSystemAdmin: true,
            slug: "test-app",
            keyword: "test",
            platform: "shopify",
            isActive: true,
            isTracked: true,
            scraperType: "app_details",
            status: "completed",
          },
        ],
        insertResult: [
          {
            id: "run-001",
            scraperType: "app_details",
            status: "pending",
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // -----------------------------------------------------------------------
  // Auth enforcement: all routes require system admin
  // -----------------------------------------------------------------------

  describe("auth enforcement", () => {
    it("returns 401 without any token on /accounts", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/accounts",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for non-admin user on /accounts", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/accounts",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 403 for viewer on /accounts", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/accounts",
        headers: authHeaders(viewerToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 401 without token on /stats", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/stats",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for non-admin on /stats", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/stats",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 401 without token on /users", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/users",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for non-admin on /users", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/users",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 401 without token on /apps", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/apps",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for non-admin on /apps", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/apps",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 401 without token on /keywords", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/keywords",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for non-admin on /keywords", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/keywords",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 401 without token on /categories", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/categories",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for non-admin on /categories", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/categories",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 401 with invalid token on any route", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/accounts",
        headers: { authorization: "Bearer invalid-garbage-token" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 without Bearer prefix", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/accounts",
        headers: { authorization: adminToken() },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/system-admin/accounts
  // -----------------------------------------------------------------------

  describe("GET /api/system-admin/accounts", () => {
    it("returns accounts for system admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/accounts",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/system-admin/accounts/:id
  // -----------------------------------------------------------------------

  describe("GET /api/system-admin/accounts/:id", () => {
    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/accounts/account-001",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns account detail for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/accounts/account-001",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // PATCH /api/system-admin/accounts/:id
  // -----------------------------------------------------------------------

  describe("PATCH /api/system-admin/accounts/:id", () => {
    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/system-admin/accounts/account-001",
        headers: authHeaders(userToken()),
        payload: { name: "Updated" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("updates account for admin", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/system-admin/accounts/account-001",
        headers: authHeaders(adminToken()),
        payload: { name: "Updated Name" },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/system-admin/accounts/:id
  // -----------------------------------------------------------------------

  describe("DELETE /api/system-admin/accounts/:id", () => {
    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/system-admin/accounts/account-001",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("deletes account for admin", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/system-admin/accounts/account-001",
        headers: authHeaders(adminToken()),
      });
      // May return 200 or 404 depending on mock, but not 403
      expect(res.statusCode).not.toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/system-admin/accounts/:id/platforms
  // -----------------------------------------------------------------------

  describe("POST /api/system-admin/accounts/:id/platforms", () => {
    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/accounts/account-001/platforms",
        headers: authHeaders(userToken()),
        payload: { platform: "shopify" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 with invalid platform", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/accounts/account-001/platforms",
        headers: authHeaders(adminToken()),
        payload: { platform: "invalid-platform" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Valid platform is required");
    });

    it("returns 400 without platform in body", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/accounts/account-001/platforms",
        headers: authHeaders(adminToken()),
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/system-admin/stats
  // -----------------------------------------------------------------------

  describe("GET /api/system-admin/stats", () => {
    it("returns stats for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/stats",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("accepts platform query parameter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/stats?platform=shopify",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/system-admin/users
  // -----------------------------------------------------------------------

  describe("GET /api/system-admin/users", () => {
    it("returns users for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/users",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/system-admin/users/:id
  // -----------------------------------------------------------------------

  describe("GET /api/system-admin/users/:id", () => {
    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/users/user-001",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns user detail for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/users/user-001",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/system-admin/apps
  // -----------------------------------------------------------------------

  describe("GET /api/system-admin/apps", () => {
    it("returns apps for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/apps",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("accepts tracked filter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/apps?tracked=true",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("accepts platform filter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/apps?platform=shopify",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/system-admin/keywords
  // -----------------------------------------------------------------------

  describe("GET /api/system-admin/keywords", () => {
    it("returns keywords for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/keywords",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("accepts platform filter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/keywords?platform=shopify",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/system-admin/keywords/:id
  // -----------------------------------------------------------------------

  describe("DELETE /api/system-admin/keywords/:id", () => {
    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/system-admin/keywords/1",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("executes for admin", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/system-admin/keywords/1",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/system-admin/categories
  // -----------------------------------------------------------------------

  describe("GET /api/system-admin/categories", () => {
    it("returns categories for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/categories",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/system-admin/scraper/trigger
  // -----------------------------------------------------------------------

  describe("POST /api/system-admin/scraper/trigger", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/scraper/trigger",
        payload: { type: "app_details" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/scraper/trigger",
        headers: authHeaders(userToken()),
        payload: { type: "app_details" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 with invalid type", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/scraper/trigger",
        headers: authHeaders(adminToken()),
        payload: { type: "invalid_type" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("type must be one of");
    });

    it("returns 400 without type", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/scraper/trigger",
        headers: authHeaders(adminToken()),
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it("accepts valid scraper type for admin", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/scraper/trigger",
        headers: authHeaders(adminToken()),
        payload: { type: "app_details", platform: "shopify" },
      });
      // Should not be 400/401/403 (may be 200 or 500 if Redis is unavailable)
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
      expect(res.statusCode).not.toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/system-admin/platform-counts
  // -----------------------------------------------------------------------

  describe("GET /api/system-admin/platform-counts", () => {
    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/platform-counts",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns counts for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/platform-counts",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/system-admin/accounts/:id/members
  // -----------------------------------------------------------------------

  describe("GET /api/system-admin/accounts/:id/members", () => {
    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/accounts/account-001/members",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns members for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/accounts/account-001/members",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Route existence via HTTP methods
  // -----------------------------------------------------------------------

  describe("route existence", () => {
    it("GET /api/system-admin/apps/:slug/accounts exists", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/apps/test-app/accounts",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("GET /api/system-admin/keywords/:id/accounts exists", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/keywords/1/accounts",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("GET /api/system-admin/categories/:id/accounts exists", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/categories/1/accounts",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("GET /api/system-admin/scraper/runs exists", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/scraper/runs",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("DELETE /api/system-admin/accounts/:id/platforms/:platform exists", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/system-admin/accounts/account-001/platforms/shopify",
        headers: authHeaders(adminToken()),
      });
      // Should not return 404 for route not found
      expect(res.statusCode).not.toBe(404);
    });

    it("GET /api/system-admin/features exists for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/features",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Platform Requests
  // -----------------------------------------------------------------------

  describe("GET /api/system-admin/platform-requests", () => {
    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/platform-requests",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 200 for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/platform-requests",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PATCH /api/system-admin/platform-requests/:id", () => {
    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/system-admin/platform-requests/req-001",
        headers: authHeaders(userToken()),
        payload: { status: "approved" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 for invalid status", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/system-admin/platform-requests/req-001",
        headers: authHeaders(adminToken()),
        payload: { status: "invalid" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when status is missing", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/system-admin/platform-requests/req-001",
        headers: authHeaders(adminToken()),
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it("accepts valid status for admin", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/system-admin/platform-requests/req-001",
        headers: authHeaders(adminToken()),
        payload: { status: "approved" },
      });
      // 200 if mock returns a row, 404 if not — both prove auth passed
      expect(res.statusCode).not.toBe(403);
      expect(res.statusCode).not.toBe(401);
    });
  });
});
