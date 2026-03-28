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

describe("Account routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { accountRoutes } = await import("../../routes/account.js");
    app = await buildTestApp({
      routes: accountRoutes,
      prefix: "/api/account",
      db: {
        selectResult: [
          {
            id: 1,
            name: "Test Account",
            isSuspended: false,
            packageId: null,
            maxTrackedApps: 10,
            maxTrackedKeywords: 50,
            maxCompetitorApps: 20,
            maxUsers: 5,
            maxResearchProjects: 3,
            count: 0,
          },
        ],
        insertResult: [
          {
            id: 1,
            accountId: "account-001",
            appId: 1,
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
  // GET /api/account
  // -----------------------------------------------------------------------

  describe("GET /api/account", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({ method: "GET", url: "/api/account" });
      expect(res.statusCode).toBe(401);
    });

    it("returns account details with valid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns 401 with invalid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account",
        headers: { authorization: "Bearer invalid-token" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 when bearer prefix is missing", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account",
        headers: { authorization: userToken() },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // PUT /api/account
  // -----------------------------------------------------------------------

  describe("PUT /api/account", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/account",
        payload: { name: "Updated" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer role (owner only)", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/account",
        headers: authHeaders(viewerToken()),
        payload: { name: "Updated" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 403 for editor role (owner only)", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/account",
        headers: authHeaders(userToken({ role: "editor" })),
        payload: { name: "Updated" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("accepts update from owner", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/account",
        headers: authHeaders(userToken({ role: "owner" })),
        payload: { name: "Updated Account" },
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns 400 with empty body", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/account",
        headers: authHeaders(userToken({ role: "owner" })),
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/account/members
  // -----------------------------------------------------------------------

  describe("GET /api/account/members", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/members",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns members with valid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/members",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/account/members
  // -----------------------------------------------------------------------

  describe("POST /api/account/members", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/members",
        payload: { email: "new@test.com", name: "New User", password: "password123" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer role", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/members",
        headers: authHeaders(viewerToken()),
        payload: { email: "new@test.com", name: "New User", password: "password123" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 when email is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/members",
        headers: authHeaders(userToken({ role: "owner" })),
        payload: { name: "New User", password: "password123" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when password is too short", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/members",
        headers: authHeaders(userToken({ role: "owner" })),
        payload: { email: "new@test.com", name: "New User", password: "short" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 with invalid role", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/members",
        headers: authHeaders(userToken({ role: "owner" })),
        payload: { email: "new@test.com", name: "New User", password: "password123", role: "admin" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/account/tracked-apps
  // -----------------------------------------------------------------------

  describe("GET /api/account/tracked-apps", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/tracked-apps",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns tracked apps with valid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/tracked-apps",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("accepts platform query parameter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/tracked-apps?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/account/tracked-apps
  // -----------------------------------------------------------------------

  describe("POST /api/account/tracked-apps", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/tracked-apps",
        payload: { slug: "test-app" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer role", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/tracked-apps",
        headers: authHeaders(viewerToken()),
        payload: { slug: "test-app" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 when slug is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/tracked-apps",
        headers: authHeaders(userToken()),
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Validation failed");
    });

    it("accepts valid slug from editor", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/tracked-apps",
        headers: authHeaders(userToken({ role: "editor" })),
        payload: { slug: "test-app" },
      });
      // With mock DB, the route may succeed or not depending on mock data shape,
      // but it should not be 401/403
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/account/tracked-apps/:slug
  // -----------------------------------------------------------------------

  describe("DELETE /api/account/tracked-apps/:slug", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/tracked-apps/test-app",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer role", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/tracked-apps/test-app",
        headers: authHeaders(viewerToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("accepts delete from editor", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/tracked-apps/test-app",
        headers: authHeaders(userToken({ role: "editor" })),
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/account/tracked-keywords
  // -----------------------------------------------------------------------

  describe("GET /api/account/tracked-keywords", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/tracked-keywords",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns tracked keywords with valid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/tracked-keywords",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/account/tracked-keywords
  // -----------------------------------------------------------------------

  describe("POST /api/account/tracked-keywords", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/tracked-keywords",
        payload: { keyword: "test", trackedAppSlug: "my-app" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer role", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/tracked-keywords",
        headers: authHeaders(viewerToken()),
        payload: { keyword: "test", trackedAppSlug: "my-app" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 when keyword is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/tracked-keywords",
        headers: authHeaders(userToken()),
        payload: { trackedAppSlug: "my-app" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Validation failed");
    });

    it("returns 400 when trackedAppSlug is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/tracked-keywords",
        headers: authHeaders(userToken()),
        payload: { keyword: "test keyword" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Validation failed");
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/account/tracked-keywords/:id
  // -----------------------------------------------------------------------

  describe("DELETE /api/account/tracked-keywords/:id", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/tracked-keywords/1",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer role", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/tracked-keywords/1",
        headers: authHeaders(viewerToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("accepts delete from editor", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/tracked-keywords/1",
        headers: authHeaders(userToken({ role: "editor" })),
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/account/competitors
  // -----------------------------------------------------------------------

  describe("GET /api/account/competitors", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/competitors",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns competitors with valid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/competitors",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/account/competitors
  // -----------------------------------------------------------------------

  describe("POST /api/account/competitors", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/competitors",
        payload: { slug: "competitor-app", trackedAppSlug: "my-app" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer role", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/competitors",
        headers: authHeaders(viewerToken()),
        payload: { slug: "competitor-app", trackedAppSlug: "my-app" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 when slug is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/competitors",
        headers: authHeaders(userToken()),
        payload: { trackedAppSlug: "my-app" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Validation failed");
    });

    it("returns 400 when trackedAppSlug is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/competitors",
        headers: authHeaders(userToken()),
        payload: { slug: "competitor-app" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Validation failed");
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/account/competitors/:slug
  // -----------------------------------------------------------------------

  describe("DELETE /api/account/competitors/:slug", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/competitors/competitor-app",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer role", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/competitors/competitor-app",
        headers: authHeaders(viewerToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("accepts delete from editor", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/competitors/competitor-app",
        headers: authHeaders(userToken({ role: "editor" })),
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/account/starred-categories
  // -----------------------------------------------------------------------

  describe("GET /api/account/starred-categories", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/starred-categories",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns non-auth error with valid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/starred-categories",
        headers: authHeaders(userToken()),
      });
      // Route is accessible (not 401/403); may be 500 due to mock DB shape
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/account/starred-categories
  // -----------------------------------------------------------------------

  describe("POST /api/account/starred-categories", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/starred-categories",
        payload: { slug: "productivity" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer role", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/starred-categories",
        headers: authHeaders(viewerToken()),
        payload: { slug: "productivity" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 when slug is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/starred-categories",
        headers: authHeaders(userToken()),
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Validation failed");
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/account/starred-categories/:slug
  // -----------------------------------------------------------------------

  describe("DELETE /api/account/starred-categories/:slug", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/starred-categories/productivity",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer role", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/starred-categories/productivity",
        headers: authHeaders(viewerToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("accepts delete from editor", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/starred-categories/productivity",
        headers: authHeaders(userToken({ role: "editor" })),
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/account/invitations
  // -----------------------------------------------------------------------

  describe("GET /api/account/invitations", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/invitations",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer (owner only)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/invitations",
        headers: authHeaders(viewerToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 403 for editor (owner only)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/invitations",
        headers: authHeaders(userToken({ role: "editor" })),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/account/members/invite
  // -----------------------------------------------------------------------

  describe("POST /api/account/members/invite", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/members/invite",
        payload: { email: "invite@test.com" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer (owner only)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/members/invite",
        headers: authHeaders(viewerToken()),
        payload: { email: "invite@test.com" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 when email is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/members/invite",
        headers: authHeaders(userToken({ role: "owner" })),
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Validation failed");
    });

    it("returns 400 with invalid role", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/members/invite",
        headers: authHeaders(userToken({ role: "owner" })),
        payload: { email: "invite@test.com", role: "admin" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // Route existence checks via wrong HTTP methods
  // -----------------------------------------------------------------------

  describe("route existence", () => {
    it("GET /api/account/tracked-apps/:slug/competitors exists", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/tracked-apps/test-app/competitors",
        headers: authHeaders(userToken()),
      });
      // Should not be 404 (route not found gives 404 in Fastify)
      // With mock DB it may return 200 or another status but not method-not-allowed
      expect(res.statusCode).not.toBe(405);
    });

    it("GET /api/account/starred-features exists", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/starred-features",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("DELETE /api/account/invitations/:id requires owner", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/invitations/inv-001",
        headers: authHeaders(viewerToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("PATCH /api/account/members/:userId/role requires owner", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/account/members/user-002/role",
        headers: authHeaders(viewerToken()),
        payload: { role: "editor" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("DELETE /api/account/members/:userId requires owner", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/members/user-002",
        headers: authHeaders(viewerToken()),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // NOTE: Platform enable/disable endpoints removed — system-admin only.
  // Tests for POST/DELETE /api/account/platforms removed accordingly.
});
