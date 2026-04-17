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
const mockGetJob = vi.fn();
vi.mock("bullmq", () => {
  let _paused = false;
  class MockQueue {
    add = vi.fn().mockResolvedValue({ id: "mock-job-1" });
    close = vi.fn().mockResolvedValue(undefined);
    getJobCounts = vi.fn().mockResolvedValue({});
    isPaused = vi.fn().mockImplementation(() => Promise.resolve(_paused));
    pause = vi.fn().mockImplementation(() => { _paused = true; return Promise.resolve(); });
    resume = vi.fn().mockImplementation(() => { _paused = false; return Promise.resolve(); });
    getJob = mockGetJob;
  }
  return { Queue: MockQueue };
});

// Mock ioredis to avoid real Redis connections
const mockRedisDel = vi.fn().mockResolvedValue(1);
vi.mock("ioredis", () => {
  return {
    default: class MockRedis {
      del = mockRedisDel;
      connect = vi.fn().mockResolvedValue(undefined);
      quit = vi.fn().mockResolvedValue(undefined);
      on = vi.fn();
    },
  };
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

    it("includes featureFlags in account detail response", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/accounts/account-001",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.featureFlags).toBeDefined();
      expect(Array.isArray(body.featureFlags)).toBe(true);
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

    // PLA-1091: regression — the endpoint used to 500 because two of its SQL
    // queries referenced non-existent columns (c.app_slug, sc.category_slug,
    // SUM(c.app_count) on categories). A statusCode-only check above passes
    // under mocked DBs but didn't catch it in prod. Assert response body shape
    // so any future column drift fails here.
    it("returns apps/keywords/categories arrays with expected shape", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/platform-counts",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as Record<string, unknown>;
      expect(body).toHaveProperty("apps");
      expect(body).toHaveProperty("keywords");
      expect(body).toHaveProperty("categories");
      expect(Array.isArray(body.apps)).toBe(true);
      expect(Array.isArray(body.keywords)).toBe(true);
      expect(Array.isArray(body.categories)).toBe(true);
    });

    // PLA-1098: the keyword-counts query used to LEFT JOIN keyword_snapshots
    // and COUNT(*), which multiplied each tracked keyword by its snapshot
    // count (~55x inflation on prod). Guard against the same bug class across
    // all three sibling queries by inspecting the source SQL directly — a
    // mock DB can't reproduce row-multiplication without heavy fixtures.
    it("platform-counts SQL does not multiply keyword rows by snapshots", async () => {
      const { readFileSync } = await import("node:fs");
      const { fileURLToPath } = await import("node:url");
      const { dirname, resolve } = await import("node:path");
      const here = dirname(fileURLToPath(import.meta.url));
      const source = readFileSync(
        resolve(here, "../../routes/system-admin.ts"),
        "utf-8"
      );

      // Extract only the platform-counts handler block so unrelated queries
      // (scraper freshness, etc.) don't trigger false positives.
      const handlerMatch = source.match(
        /app\.get\("\/platform-counts".*?\n  \}\);/s
      );
      expect(handlerMatch, "platform-counts handler not found").toBeTruthy();
      const handler = handlerMatch![0];

      // The bug: `LEFT JOIN keyword_snapshots … GROUP BY` in the SAME query
      // as `COUNT(*)` inflates counts.
      const bugPattern =
        /LEFT JOIN\s+keyword_snapshots[\s\S]{0,400}?GROUP BY\s+tk\.platform/i;
      expect(bugPattern.test(handler)).toBe(false);

      // Siblings (appCounts uses EXISTS; catCounts uses LATERAL LIMIT 1) —
      // make sure neither regresses into a non-bounded join either.
      expect(/LEFT JOIN\s+app_snapshots/i.test(handler)).toBe(false);
      // catCounts LATERAL … LIMIT 1 is safe, but a plain LEFT JOIN
      // category_snapshots without LIMIT 1 would be a bug.
      const catLeftJoin = handler.match(/LEFT JOIN\s+category_snapshots/gi) || [];
      for (const _ of catLeftJoin) {
        expect(/LATERAL[\s\S]*?LIMIT\s+1/i.test(handler)).toBe(true);
      }
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

  // -----------------------------------------------------------------------
  // Queue Pause/Resume Controls (PLA-874)
  // -----------------------------------------------------------------------

  describe("GET /api/system-admin/queues/:queueName/status", () => {
    it("returns 401 without token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/queues/email-instant/status",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/queues/email-instant/status",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 for invalid queue name", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/queues/invalid-queue/status",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toContain("Invalid queue");
    });

    it("returns isPaused status for valid queue", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/queues/email-instant/status",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("queueName", "email-instant");
      expect(body).toHaveProperty("isPaused");
      expect(typeof body.isPaused).toBe("boolean");
    });

    it("accepts all 5 valid queue names", async () => {
      const validQueues = [
        "scraper-jobs-background",
        "scraper-jobs-interactive",
        "email-instant",
        "email-bulk",
        "notifications",
      ];
      for (const queueName of validQueues) {
        const res = await app.inject({
          method: "GET",
          url: `/api/system-admin/queues/${queueName}/status`,
          headers: authHeaders(adminToken()),
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().queueName).toBe(queueName);
      }
    });
  });

  describe("POST /api/system-admin/queues/:queueName/pause", () => {
    it("returns 401 without token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/queues/email-instant/pause",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/queues/email-instant/pause",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 for invalid queue name", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/queues/bad-queue/pause",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(400);
    });

    it("pauses a valid queue and returns isPaused: true", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/queues/notifications/pause",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toEqual({ queueName: "notifications", isPaused: true });
    });
  });

  describe("POST /api/system-admin/queues/:queueName/resume", () => {
    it("returns 401 without token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/queues/email-instant/resume",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/queues/email-instant/resume",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 for invalid queue name", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/queues/bad-queue/resume",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(400);
    });

    it("resumes a valid queue and returns isPaused: false", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/queues/scraper-jobs-background/resume",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toEqual({ queueName: "scraper-jobs-background", isPaused: false });
    });
  });

  // -----------------------------------------------------------------------
  // Scraper platform toggle
  // -----------------------------------------------------------------------

  describe("GET /api/system-admin/scraper/platforms", () => {
    it("returns 401 without token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/scraper/platforms",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/scraper/platforms",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns platform list for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/scraper/platforms",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
      expect(body[0]).toHaveProperty("platform");
      expect(body[0]).toHaveProperty("isVisible");
      expect(body[0]).toHaveProperty("scraperEnabled");
    });
  });

  describe("PATCH /api/system-admin/scraper/platform/:platform/toggle", () => {
    it("returns 401 without token", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/system-admin/scraper/platform/shopify/toggle",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/system-admin/scraper/platform/shopify/toggle",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 for invalid platform", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/system-admin/scraper/platform/invalid_platform/toggle",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(400);
    });

    it("toggles scraper for valid platform", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/system-admin/scraper/platform/shopify/toggle",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/system-admin/scraper/runs/:id/force-kill
  // -----------------------------------------------------------------------

  describe("POST /scraper/runs/:id/force-kill", () => {
    it("returns 401 without token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/scraper/runs/run-001/force-kill",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for non-admin user", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/scraper/runs/run-001/force-kill",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 404 when run not found", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/scraper/runs/00000000-0000-0000-0000-000000000000/force-kill",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /scraper/runs/:id/force-kill (with run data)", () => {
    let forceKillApp: FastifyInstance;

    beforeAll(async () => {
      const { systemAdminRoutes } = await import("../../routes/system-admin.js");
      forceKillApp = await buildTestApp({
        routes: systemAdminRoutes,
        prefix: "/api/system-admin",
        db: {
          selectResult: [{
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
          }],
          executeResult: [{
            id: "run-001",
            platform: "shopify",
            scraperType: "app_details",
            jobId: "1739",
            queue: "scraper-jobs-background",
          }],
        },
      });
    });

    afterAll(async () => {
      await forceKillApp.close();
    });

    it("force-kills a running run, releases lock and returns success", async () => {
      mockRedisDel.mockResolvedValueOnce(1);
      mockGetJob.mockResolvedValueOnce(null);

      const res = await forceKillApp.inject({
        method: "POST",
        url: "/api/system-admin/scraper/runs/run-001/force-kill",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.platform).toBe("shopify");
      expect(body.scraperType).toBe("app_details");
      expect(body.lockKey).toBe("lock:platform:shopify:app_details");
      expect(body.lockReleased).toBe(true);
    });

    it("is idempotent — force-kill on already-failed run still deletes lock", async () => {
      mockRedisDel.mockResolvedValueOnce(0);
      mockGetJob.mockResolvedValueOnce(null);

      const res = await forceKillApp.inject({
        method: "POST",
        url: "/api/system-admin/scraper/runs/run-001/force-kill",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.lockReleased).toBe(false);
    });

    it("survives Redis DEL failure gracefully", async () => {
      mockRedisDel.mockRejectedValueOnce(new Error("Redis connection lost"));
      mockGetJob.mockResolvedValueOnce(null);

      const res = await forceKillApp.inject({
        method: "POST",
        url: "/api/system-admin/scraper/runs/run-001/force-kill",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.lockReleased).toBe(false);
    });

    it("attempts BullMQ job cleanup when jobId exists", async () => {
      const mockMoveToFailed = vi.fn().mockResolvedValue(undefined);
      mockRedisDel.mockResolvedValueOnce(1);
      mockGetJob.mockResolvedValueOnce({ moveToFailed: mockMoveToFailed });

      const res = await forceKillApp.inject({
        method: "POST",
        url: "/api/system-admin/scraper/runs/run-001/force-kill",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.jobCancelled).toBe(true);
      expect(mockMoveToFailed).toHaveBeenCalledWith(
        expect.any(Error),
        "0",
        false,
      );
    });

    it("survives BullMQ job cleanup failure gracefully", async () => {
      mockRedisDel.mockResolvedValueOnce(1);
      mockGetJob.mockRejectedValueOnce(new Error("BullMQ error"));

      const res = await forceKillApp.inject({
        method: "POST",
        url: "/api/system-admin/scraper/runs/run-001/force-kill",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.jobCancelled).toBe(false);
    });
  });
});
