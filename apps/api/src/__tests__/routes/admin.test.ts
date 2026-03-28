import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  userToken,
  adminToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildAdminApp(dbOverrides = {}) {
  const { adminRoutes } = await import("../../routes/admin.js");
  return buildTestApp({
    routes: adminRoutes,
    prefix: "/api/admin",
    db: dbOverrides,
  });
}

describe("Admin routes — auth guard", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildAdminApp({
      insertResult: [{ id: 1, slug: "test-app", isTracked: true }],
      selectResult: [],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // All endpoints that must be system-admin only
  const endpoints = [
    { method: "POST" as const, url: "/api/admin/tracked-apps", body: { slug: "test-app" } },
    { method: "DELETE" as const, url: "/api/admin/tracked-apps/test-app" },
    { method: "POST" as const, url: "/api/admin/tracked-keywords", body: { keyword: "crm" } },
    { method: "DELETE" as const, url: "/api/admin/tracked-keywords/1" },
    { method: "GET" as const, url: "/api/admin/scraper/runs" },
    { method: "POST" as const, url: "/api/admin/scraper/trigger", body: { type: "category" } },
    { method: "GET" as const, url: "/api/admin/stats" },
  ];

  // =========================================================================
  // Unauthenticated → 401
  // =========================================================================

  describe("unauthenticated requests", () => {
    for (const ep of endpoints) {
      it(`${ep.method} ${ep.url} returns 401 without auth`, async () => {
        const res = await app.inject({
          method: ep.method,
          url: ep.url,
          ...(ep.body ? { payload: ep.body } : {}),
        });
        expect(res.statusCode).toBe(401);
      });
    }
  });

  // =========================================================================
  // Non-admin user → 403
  // =========================================================================

  describe("non-admin user requests", () => {
    for (const ep of endpoints) {
      it(`${ep.method} ${ep.url} returns 403 for regular user`, async () => {
        const res = await app.inject({
          method: ep.method,
          url: ep.url,
          headers: authHeaders(userToken()),
          ...(ep.body ? { payload: ep.body } : {}),
        });
        expect(res.statusCode).toBe(403);
      });
    }
  });

  // =========================================================================
  // System admin → 200
  // =========================================================================

  describe("system admin requests", () => {
    it("POST /api/admin/tracked-apps returns 200 for admin", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/tracked-apps",
        headers: authHeaders(adminToken()),
        payload: { slug: "test-app" },
      });
      expect(res.statusCode).toBe(200);
    });

    it("DELETE /api/admin/tracked-apps/:slug returns 200 for admin", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/admin/tracked-apps/test-app",
        headers: authHeaders(adminToken()),
      });
      // 200 (found) or 404 (mock returns empty) — not 403
      expect([200, 404]).toContain(res.statusCode);
    });

    it("POST /api/admin/tracked-keywords returns 200 for admin", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/tracked-keywords",
        headers: authHeaders(adminToken()),
        payload: { keyword: "crm" },
      });
      expect(res.statusCode).toBe(200);
    });

    it("DELETE /api/admin/tracked-keywords/:id returns 200 for admin", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/admin/tracked-keywords/1",
        headers: authHeaders(adminToken()),
      });
      expect([200, 404]).toContain(res.statusCode);
    });

    it("GET /api/admin/scraper/runs returns 200 for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/admin/scraper/runs",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("GET /api/admin/stats passes auth guard for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/admin/stats",
        headers: authHeaders(adminToken()),
      });
      // Mock DB may not support the complex subquery, so we just verify
      // it's not a 401/403 (auth passed)
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });
});
