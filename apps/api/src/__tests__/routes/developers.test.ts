import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  userToken,
  adminToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";
import { developerRoutes } from "../../routes/developers.js";

describe("Developer routes", () => {
  let app: FastifyInstance;

  const mockDeveloper = {
    id: 1,
    slug: "jotform",
    name: "Jotform",
    website: "https://jotform.com",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    app = await buildTestApp({
      routes: developerRoutes,
      prefix: "/api/developers",
      db: {
        selectResult: [],
        executeResult: [],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // -----------------------------------------------------------------------
  // GET /api/developers
  // -----------------------------------------------------------------------
  describe("GET /api/developers", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/developers",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns developer list with pagination", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/developers",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("developers");
      expect(body).toHaveProperty("pagination");
      expect(body.pagination).toHaveProperty("page");
      expect(body.pagination).toHaveProperty("limit");
      expect(body.pagination).toHaveProperty("total");
      expect(body.pagination).toHaveProperty("totalPages");
    });

    it("returns topApps, appCount, and isStarred fields for each developer", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/developers",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      for (const dev of body.developers) {
        expect(dev).toHaveProperty("topApps");
        expect(Array.isArray(dev.topApps)).toBe(true);
        expect(dev).toHaveProperty("appCount");
        expect(typeof dev.appCount).toBe("number");
        expect(dev).toHaveProperty("isStarred");
        expect(typeof dev.isStarred).toBe("boolean");
      }
    });

    it("accepts search parameter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/developers?search=jotform",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
    });

    it("accepts pagination parameters", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/developers?page=2&limit=10",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.pagination.page).toBe(2);
      expect(body.pagination.limit).toBe(10);
    });

    it("accepts sort=apps parameter without error", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/developers?sort=apps&order=desc",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
    });

    it("accepts sort=platforms parameter without error", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/developers?sort=platforms&order=asc",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
    });

    it("defaults to name sort for unknown sort field", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/developers?sort=invalid_field",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/developers/:slug
  // -----------------------------------------------------------------------
  describe("GET /api/developers/:slug", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/developers/jotform",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 404 for non-existent developer", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/developers/nonexistent",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Developer not found" });
    });
  });

  // -----------------------------------------------------------------------
  // Admin endpoints
  // -----------------------------------------------------------------------
  describe("Admin endpoints", () => {
    it("GET /admin/list returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/developers/admin/list",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("GET /admin/list returns 200 for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/developers/admin/list",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("developers");
      expect(body).toHaveProperty("pagination");
    });

    it("POST /admin/create returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/developers/admin/create",
        headers: { ...authHeaders(userToken()), "content-type": "application/json" },
        payload: { name: "Test Dev" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("POST /admin/merge returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/developers/admin/merge",
        headers: { ...authHeaders(userToken()), "content-type": "application/json" },
        payload: { sourceId: 1, targetId: 2 },
      });
      expect(res.statusCode).toBe(403);
    });

    it("POST /admin/merge returns 400 for same IDs", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/developers/admin/merge",
        headers: { ...authHeaders(adminToken()), "content-type": "application/json" },
        payload: { sourceId: 1, targetId: 1 },
      });
      expect(res.statusCode).toBe(400);
    });

    it("POST /admin/unlink returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/developers/admin/unlink",
        headers: { ...authHeaders(userToken()), "content-type": "application/json" },
        payload: { platformDeveloperId: 1 },
      });
      expect(res.statusCode).toBe(403);
    });

    it("POST /admin/link returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/developers/admin/link",
        headers: { ...authHeaders(userToken()), "content-type": "application/json" },
        payload: { platformDeveloperId: 1, globalDeveloperId: 2 },
      });
      expect(res.statusCode).toBe(403);
    });

    it("GET /admin/suggestions returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/developers/admin/suggestions",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
