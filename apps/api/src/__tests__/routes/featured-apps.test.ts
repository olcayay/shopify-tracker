import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  createMockDb,
  userToken,
  adminToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";

describe("Featured apps routes", () => {
  let app: FastifyInstance;

  const mockSightings = [
    {
      appSlug: "app-1",
      appName: "App One",
      iconUrl: "https://cdn.example.com/icon1.png",
      surface: "home",
      surfaceDetail: null,
      sectionHandle: "trending",
      sectionTitle: "Trending Apps",
      position: 1,
      seenDate: "2026-03-20",
      timesSeenInDay: 3,
    },
    {
      appSlug: "app-2",
      appName: "App Two",
      iconUrl: "https://cdn.example.com/icon2.png",
      surface: "category",
      surfaceDetail: "marketing",
      sectionHandle: "staff-picks",
      sectionTitle: "Staff Picks",
      position: 2,
      seenDate: "2026-03-19",
      timesSeenInDay: 1,
    },
  ];

  beforeAll(async () => {
    const { featuredAppRoutes } = await import(
      "../../routes/featured-apps.js"
    );

    app = await buildTestApp({
      routes: featuredAppRoutes,
      prefix: "/api/featured-apps",
      db: {
        selectResult: mockSightings,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // -----------------------------------------------------------------------
  // Auth enforcement
  // -----------------------------------------------------------------------

  describe("authentication", () => {
    it("GET / returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("GET /my-apps returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps/my-apps?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("GET /sections returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps/sections?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 with invalid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps?platform=shopify",
        headers: { authorization: "Bearer bad-token" },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/featured-apps
  // -----------------------------------------------------------------------

  describe("GET /api/featured-apps", () => {
    it("returns 200 with valid auth and platform", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns sightings, trackedSlugs, and competitorSlugs", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps?platform=shopify",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      expect(body).toHaveProperty("sightings");
      expect(body).toHaveProperty("trackedSlugs");
      expect(body).toHaveProperty("competitorSlugs");
      expect(Array.isArray(body.sightings)).toBe(true);
      expect(Array.isArray(body.trackedSlugs)).toBe(true);
      expect(Array.isArray(body.competitorSlugs)).toBe(true);
    });

    it("defaults to shopify when platform is omitted", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps",
        headers: authHeaders(userToken()),
      });
      // Should succeed (defaults to shopify)
      expect(res.statusCode).toBe(200);
    });

    it("returns 400 for invalid platform", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps?platform=invalid_platform",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(400);
    });

    it("accepts optional days parameter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps?platform=shopify&days=7",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("accepts optional surface filter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps?platform=shopify&surface=home",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("accepts optional surfaceDetail filter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps?platform=shopify&surfaceDetail=marketing",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("accepts optional surfaceDetailPrefix filter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps?platform=shopify&surfaceDetailPrefix=market",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("works with admin token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps?platform=shopify",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("sightings");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/featured-apps/my-apps
  // -----------------------------------------------------------------------

  describe("GET /api/featured-apps/my-apps", () => {
    it("returns 200 with valid auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps/my-apps?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns sightings, trackedSlugs, and competitorSlugs", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps/my-apps?platform=shopify",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      expect(body).toHaveProperty("sightings");
      expect(body).toHaveProperty("trackedSlugs");
      expect(body).toHaveProperty("competitorSlugs");
    });

    it("accepts optional days parameter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps/my-apps?platform=shopify&days=14",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns 400 for invalid platform", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps/my-apps?platform=bogus",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/featured-apps/sections
  // -----------------------------------------------------------------------

  describe("GET /api/featured-apps/sections", () => {
    it("returns 200 with valid auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps/sections?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns an array of section summaries", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps/sections?platform=shopify",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    it("accepts optional days parameter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps/sections?platform=shopify&days=60",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns 400 for invalid platform", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/featured-apps/sections?platform=not_real",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
