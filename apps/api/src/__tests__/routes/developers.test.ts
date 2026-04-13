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

    it("accepts sort=avgRating and sort=avgReviews without error", async () => {
      const r1 = await app.inject({
        method: "GET",
        url: "/api/developers?sort=avgRating&order=desc",
        headers: authHeaders(userToken()),
      });
      expect(r1.statusCode).toBe(200);
      const r2 = await app.inject({
        method: "GET",
        url: "/api/developers?sort=avgReviews&order=asc",
        headers: authHeaders(userToken()),
      });
      expect(r2.statusCode).toBe(200);
    });

    it("accepts sort=firstLaunch and sort=lastLaunch without error", async () => {
      const r1 = await app.inject({
        method: "GET",
        url: "/api/developers?sort=firstLaunch&order=asc",
        headers: authHeaders(userToken()),
      });
      expect(r1.statusCode).toBe(200);
      const r2 = await app.inject({
        method: "GET",
        url: "/api/developers?sort=lastLaunch&order=desc",
        headers: authHeaders(userToken()),
      });
      expect(r2.statusCode).toBe(200);
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

    it("returns empty developers array with correct pagination when account has no visible platforms", async () => {
      // When getVisiblePlatforms returns empty (no account_platforms entries),
      // the endpoint should short-circuit and return a valid empty response
      const res = await app.inject({
        method: "GET",
        url: "/api/developers",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.developers).toEqual([]);
      expect(body.pagination).toEqual({
        page: 1,
        limit: expect.any(Number),
        total: 0,
        totalPages: 0,
      });
    });

    it("accepts platforms query parameter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/developers?platforms=shopify,wix",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("developers");
      expect(body).toHaveProperty("pagination");
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

    it("returns 404 when developer exists but account has no visible platforms", async () => {
      const detailApp = await buildTestApp({
        routes: developerRoutes,
        prefix: "/api/developers",
        db: {
          selectResult: [],
          executeResult: [],
        },
      });

      let selectCallIdx = 0;
      const mockDb = (detailApp as any).db;
      mockDb.select = (..._args: any[]) => {
        selectCallIdx++;
        if (selectCallIdx === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([mockDeveloper]),
              }),
            }),
          };
        }
        if (selectCallIdx === 2) {
          return {
            from: () => ({
              leftJoin: () => ({
                where: () => Promise.resolve([]),
              }),
            }),
          };
        }
        return {
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        };
      };

      const res = await detailApp.inject({
        method: "GET",
        url: "/api/developers/jotform",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Developer not found" });
      await detailApp.close();
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/developers/tracked
  // -----------------------------------------------------------------------
  describe("GET /api/developers/tracked", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/developers/tracked",
      });
      expect(res.statusCode).toBe(401);
    });

    it("includes totalApps field for each developer", async () => {
      const trackedApp = await buildTestApp({
        routes: developerRoutes,
        prefix: "/api/developers",
        db: {
          executeResult: [
            {
              id: 1,
              slug: "acme",
              name: "Acme",
              total_apps: 42,
              platform_count: 1,
              platforms: ["shopify"],
              is_starred: false,
              tracked_apps: [],
            },
          ],
        },
      });

      const res = await trackedApp.inject({
        method: "GET",
        url: "/api/developers/tracked",
        headers: authHeaders(adminToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.developers).toHaveLength(1);
      expect(body.developers[0].totalApps).toBe(42);
      await trackedApp.close();
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/developers/competitors
  // -----------------------------------------------------------------------
  describe("GET /api/developers/competitors", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/developers/competitors",
      });
      expect(res.statusCode).toBe(401);
    });

    it("includes totalApps field for each developer", async () => {
      const compApp = await buildTestApp({
        routes: developerRoutes,
        prefix: "/api/developers",
        db: {
          executeResult: [
            {
              id: 2,
              slug: "rival",
              name: "Rival Co",
              total_apps: 7,
              platform_count: 1,
              platforms: ["shopify"],
              is_starred: false,
              competitor_apps: [],
            },
          ],
        },
      });

      const res = await compApp.inject({
        method: "GET",
        url: "/api/developers/competitors",
        headers: authHeaders(adminToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.developers).toHaveLength(1);
      expect(body.developers[0].totalApps).toBe(7);
      await compApp.close();
    });
  });

  // -----------------------------------------------------------------------
  // Admin endpoints
  // -----------------------------------------------------------------------
  describe("GET /api/developers — per-developer aggregate fields (PLA-1074)", () => {
    let appWithRows: FastifyInstance;

    beforeAll(async () => {
      appWithRows = await buildTestApp({
        routes: developerRoutes,
        prefix: "/api/developers",
        db: {
          // Both db.execute() calls (count + main) return this same array.
          // The count query will read `.count` off the first row (undefined → 0),
          // and the main query will map over rows with the aggregate columns.
          executeResult: [
            {
              id: 1,
              slug: "acme",
              name: "Acme Inc",
              website: null,
              platform_count: 1,
              link_count: 1,
              platforms: ["shopify"],
              top_apps: [],
              app_count: 3,
              avg_review_count: "1234.50",
              avg_rating: "4.25",
              first_launch_date: "2019-03-15T00:00:00Z",
              last_launch_date: "2025-11-01T00:00:00Z",
              is_starred: false,
            },
          ],
        },
      });
    });

    afterAll(async () => {
      await appWithRows.close();
    });

    it("surfaces avgReviewCount, avgRating, firstAppLaunchDate, lastAppLaunchDate", async () => {
      const res = await appWithRows.inject({
        method: "GET",
        url: "/api/developers",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.developers.length).toBeGreaterThan(0);
      const dev = body.developers[0];
      expect(dev.avgReviewCount).toBeCloseTo(1234.5, 2);
      expect(dev.avgRating).toBeCloseTo(4.25, 2);
      expect(dev.firstAppLaunchDate).toBe("2019-03-15T00:00:00.000Z");
      expect(dev.lastAppLaunchDate).toBe("2025-11-01T00:00:00.000Z");
    });

    it("returns null for missing aggregates", async () => {
      const emptyApp = await buildTestApp({
        routes: developerRoutes,
        prefix: "/api/developers",
        db: {
          executeResult: [
            {
              id: 2,
              slug: "solo",
              name: "Solo Dev",
              website: null,
              platform_count: 1,
              link_count: 1,
              platforms: ["shopify"],
              top_apps: [],
              app_count: 1,
              avg_review_count: null,
              avg_rating: null,
              first_launch_date: null,
              last_launch_date: null,
              is_starred: false,
            },
          ],
        },
      });
      const res = await emptyApp.inject({
        method: "GET",
        url: "/api/developers",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
      const dev = res.json().developers[0];
      expect(dev.avgReviewCount).toBeNull();
      expect(dev.avgRating).toBeNull();
      expect(dev.firstAppLaunchDate).toBeNull();
      expect(dev.lastAppLaunchDate).toBeNull();
      await emptyApp.close();
    });
  });

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
