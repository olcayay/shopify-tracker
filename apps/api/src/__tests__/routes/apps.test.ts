import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  createMockDb,
  userToken,
  adminToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildAppsApp(dbOverrides = {}) {
  const { appRoutes } = await import("../../routes/apps.js");
  return buildTestApp({
    routes: appRoutes,
    prefix: "/api/apps",
    db: dbOverrides,
  });
}

describe("App routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildAppsApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // GET /api/apps — list tracked apps
  // =========================================================================

  describe("GET /api/apps", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 with invalid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps?platform=shopify",
        headers: { authorization: "Bearer invalid-token-here" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 200 with valid auth and platform param", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns an array (empty when mock DB returns no tracked rows)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    it("defaults to shopify when no platform param is given", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps",
        headers: authHeaders(userToken()),
      });
      // getPlatformFromQuery defaults to "shopify" when omitted
      expect(res.statusCode).toBe(200);
    });

    it("returns 400 for an invalid platform", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps?platform=invalid_platform",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(400);
    });

    it("accepts all valid platforms", async () => {
      for (const platform of ["shopify", "salesforce", "canva", "wix"]) {
        const res = await app.inject({
          method: "GET",
          url: `/api/apps?platform=${platform}`,
          headers: authHeaders(userToken()),
        });
        expect(res.statusCode).toBe(200);
      }
    });
  });

  // =========================================================================
  // GET /api/apps/search?q=
  // =========================================================================

  describe("GET /api/apps/search", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/search?platform=shopify&q=test",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 200 with valid query", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/search?platform=shopify&q=test",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns an empty array when q is empty", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/search?platform=shopify&q=",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns an array shape for search results", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/search?platform=shopify&q=a",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  // =========================================================================
  // GET /api/apps/:slug — app detail
  // =========================================================================

  describe("GET /api/apps/:slug", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/some-app?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 200 with mock data (empty select resolves to empty array, app not found path)", async () => {
      // With default mock DB returning [], the route destructures [appRow] = [] => appRow = undefined
      // and should return 404
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/some-app?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "App not found" });
    });

    it("returns 400 for invalid platform on slug route", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/some-app?platform=bogus",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // GET /api/apps/:slug/reviews
  // =========================================================================

  describe("GET /api/apps/:slug/reviews", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/some-app/reviews?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 404 when app not found (mock DB empty)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/some-app/reviews?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "App not found" });
    });
  });

  // =========================================================================
  // GET /api/apps/:slug/rankings
  // =========================================================================

  describe("GET /api/apps/:slug/rankings", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/some-app/rankings?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 404 when app not found", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/some-app/rankings?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "App not found" });
    });
  });

  // =========================================================================
  // GET /api/apps/:slug/history
  // =========================================================================

  describe("GET /api/apps/:slug/history", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/some-app/history?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 404 when app not found", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/some-app/history?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "App not found" });
    });
  });

  // =========================================================================
  // GET /api/apps/:slug/changes
  // =========================================================================

  describe("GET /api/apps/:slug/changes", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/some-app/changes?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns an empty array when app not found (changes returns [])", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/some-app/changes?platform=shopify",
        headers: authHeaders(userToken()),
      });
      // changes route returns [] when app not found, not 404
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });
  });

  // =========================================================================
  // GET /api/apps/:slug/membership
  // =========================================================================

  describe("GET /api/apps/:slug/membership", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/some-app/membership?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 404 when app not found", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/some-app/membership?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "App not found" });
    });
  });

  // =========================================================================
  // POST /api/apps/last-changes — bulk lookup
  // =========================================================================

  describe("POST /api/apps/last-changes", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/last-changes?platform=shopify",
        payload: { slugs: ["app-1"] },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when slugs is empty", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/last-changes?platform=shopify",
        headers: authHeaders(userToken()),
        payload: { slugs: [] },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Validation failed");
    });

    it("returns 200 with valid payload", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/last-changes?platform=shopify",
        headers: authHeaders(userToken()),
        payload: { slugs: ["app-1", "app-2"] },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(typeof body).toBe("object");
    });
  });

  // =========================================================================
  // POST /api/apps/min-paid-prices
  // =========================================================================

  describe("POST /api/apps/min-paid-prices", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/min-paid-prices?platform=shopify",
        payload: { slugs: ["app-1"] },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when slugs is empty", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/min-paid-prices?platform=shopify",
        headers: authHeaders(userToken()),
        payload: { slugs: [] },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Validation failed");
    });
  });

  // =========================================================================
  // GET /api/apps/by-developer
  // =========================================================================

  describe("GET /api/apps/by-developer", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/by-developer?platform=shopify&name=Acme",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns empty array when name is empty", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/by-developer?platform=shopify&name=",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });
  });

  // =========================================================================
  // Route method enforcement
  // =========================================================================

  describe("Method enforcement", () => {
    it("GET on POST-only route returns 404", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/last-changes?platform=shopify",
        headers: authHeaders(userToken()),
      });
      // /last-changes is a POST route; GET will hit :slug route instead
      // and return 404 since there's no app with slug "last-changes"
      expect(res.statusCode).toBe(404);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests with custom mock DB data
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bug regression: empty platform returns [] instead of 500 (PLA-236)
// ---------------------------------------------------------------------------

describe("App routes — empty platform regression (PLA-236)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Simulate: account has tracked apps for other platforms, but the
    // requested platform has none. The first select (trackedRows) must
    // return rows, subsequent selects return [].
    let selectCallCount = 0;
    const { appRoutes } = await import("../../routes/apps.js");
    app = await buildTestApp({
      routes: appRoutes,
      prefix: "/api/apps",
      db: {
        // First select → trackedRows (has items); rest → []
        selectResult: new Proxy([], {
          get(target, prop) {
            if (prop === "then") {
              selectCallCount++;
              if (selectCallCount === 1) {
                // trackedRows: account has tracked apps
                return (resolve: any) => resolve([{ appId: 1 }, { appId: 2 }]);
              }
              // subsequent selects: no apps for this platform
              return (resolve: any) => resolve([]);
            }
            return (target as any)[prop];
          },
        }),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns [] instead of 500 when account has tracked apps but none for the requested platform", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/apps?platform=wix",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

describe("App routes — with mock data", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { appRoutes } = await import("../../routes/apps.js");
    app = await buildTestApp({
      routes: appRoutes,
      prefix: "/api/apps",
      db: {
        selectResult: [
          {
            id: 1,
            slug: "test-app",
            name: "Test App",
            platform: "shopify",
            iconUrl: "https://example.com/icon.png",
            isBuiltForShopify: true,
            averageRating: "4.5",
            ratingCount: 100,
            appId: 1,
            accountId: "account-001",
          },
        ],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/apps/:slug returns app data when found", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/apps/test-app?platform=shopify",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("slug", "test-app");
    expect(body).toHaveProperty("name", "Test App");
    expect(body).toHaveProperty("latestSnapshot");
    expect(body).toHaveProperty("isTrackedByAccount");
    expect(body).toHaveProperty("competitorForApps");
  });

  it("GET /api/apps/:slug/reviews returns review data shape when app found", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/apps/test-app/reviews?platform=shopify",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("app");
    expect(body).toHaveProperty("reviews");
    // total and distribution depend on count(*) which the mock DB doesn't
    // provide, but the keys should still exist (even if undefined/stripped)
    expect(body.app).toHaveProperty("slug", "test-app");
  });

  it("GET /api/apps/:slug/rankings returns ranking data shape when app found", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/apps/test-app/rankings?platform=shopify",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("app");
    expect(body).toHaveProperty("categoryRankings");
    expect(body).toHaveProperty("keywordRankings");
  });

  it("GET /api/apps/:slug/history returns history data shape when app found", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/apps/test-app/history?platform=shopify",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("app");
    expect(body).toHaveProperty("snapshots");
    expect(body.app).toHaveProperty("slug", "test-app");
  });

  // =========================================================================
  // GET /api/apps/developers — list developers (system admin only)
  // =========================================================================

  describe("GET /api/apps/developers", () => {
    it("returns 403 for non-admin users", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/developers?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 200 with developer list for admin", async () => {
      const mockDevs = [
        { developer_name: "Acme Corp", app_count: 5, email: null, country: null },
      ];
      const adminApp = await buildAppsApp({ executeResult: mockDevs });
      const res = await adminApp.inject({
        method: "GET",
        url: "/api/apps/developers?platform=shopify",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toEqual(mockDevs);
      await adminApp.close();
    });

    it("returns 400 for invalid platform", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/apps/developers?platform=invalid_platform",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
