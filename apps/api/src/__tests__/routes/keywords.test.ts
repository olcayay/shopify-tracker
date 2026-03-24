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

async function buildKeywordsApp(dbOverrides = {}) {
  const { keywordRoutes } = await import("../../routes/keywords.js");
  return buildTestApp({
    routes: keywordRoutes,
    prefix: "/api/keywords",
    db: dbOverrides,
  });
}

describe("Keyword routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildKeywordsApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // GET /api/keywords — list tracked keywords
  // =========================================================================

  describe("GET /api/keywords", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 with invalid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords?platform=shopify",
        headers: { authorization: "Bearer bad.token.here" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 200 with valid auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns an empty array when no tracked keywords exist", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("defaults to shopify when no platform param is given", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns 400 for an invalid platform", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords?platform=invalid_one",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // GET /api/keywords/search?q=
  // =========================================================================

  describe("GET /api/keywords/search", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords/search?platform=shopify&q=test",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns empty array when q is empty", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords/search?platform=shopify&q=",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns 200 with a valid search query", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords/search?platform=shopify&q=seo",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  // =========================================================================
  // GET /api/keywords/:slug — keyword detail
  // =========================================================================

  describe("GET /api/keywords/:slug", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords/seo-optimization?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 404 when keyword not found (mock DB returns empty)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords/nonexistent-keyword?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Keyword not found" });
    });

    it("returns 400 for invalid platform on slug route", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords/some-keyword?platform=bogus",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // GET /api/keywords/:slug/rankings
  // =========================================================================

  describe("GET /api/keywords/:slug/rankings", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords/seo/rankings?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 404 when keyword not found", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords/nonexistent/rankings?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Keyword not found" });
    });
  });

  // =========================================================================
  // GET /api/keywords/:slug/ads
  // =========================================================================

  describe("GET /api/keywords/:slug/ads", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords/seo/ads?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 404 when keyword not found", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords/nonexistent/ads?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Keyword not found" });
    });
  });

  // =========================================================================
  // GET /api/keywords/:slug/history
  // =========================================================================

  describe("GET /api/keywords/:slug/history", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords/seo/history?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 404 when keyword not found", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords/nonexistent/history?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Keyword not found" });
    });
  });

  // =========================================================================
  // GET /api/keywords/:slug/suggestions
  // =========================================================================

  describe("GET /api/keywords/:slug/suggestions", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords/seo/suggestions?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 404 when keyword not found", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/keywords/nonexistent/suggestions?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Keyword not found" });
    });
  });
});

// ---------------------------------------------------------------------------
// Tests with custom mock DB data
// ---------------------------------------------------------------------------

describe("Keyword routes — with mock data", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildKeywordsApp({
      selectResult: [
        {
          id: 42,
          keyword: "seo optimization",
          slug: "seo-optimization",
          platform: "shopify",
          isActive: true,
          keywordId: 42,
          trackedAppSlug: "test-app",
          accountId: "account-001",
          totalResults: 150,
          scrapedAt: new Date().toISOString(),
          results: [],
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/keywords/:slug returns keyword data when found", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/keywords/seo-optimization?platform=shopify",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("slug", "seo-optimization");
    expect(body).toHaveProperty("keyword", "seo optimization");
    expect(body).toHaveProperty("latestSnapshot");
    expect(body).toHaveProperty("isTrackedByAccount");
    expect(body).toHaveProperty("trackedForApps");
  });

  it("GET /api/keywords/:slug/rankings returns rankings shape when keyword found", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/keywords/seo-optimization/rankings?platform=shopify",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("keyword");
    expect(body).toHaveProperty("rankings");
  });

  it("GET /api/keywords/:slug/ads returns ad sightings shape when keyword found", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/keywords/seo-optimization/ads?platform=shopify",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("keyword");
    expect(body).toHaveProperty("adSightings");
  });

  it("GET /api/keywords/:slug/history returns history shape when keyword found", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/keywords/seo-optimization/history?platform=shopify",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("keyword");
    expect(body).toHaveProperty("snapshots");
    expect(body.keyword).toHaveProperty("slug", "seo-optimization");
  });

  it("GET /api/keywords/:slug/suggestions returns suggestions shape when keyword found", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/keywords/seo-optimization/suggestions?platform=shopify",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("suggestions");
    expect(body).toHaveProperty("scrapedAt");
  });
});
