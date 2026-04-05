import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  createMockDb,
  userToken,
  adminToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";
import { platformRoutes } from "../../routes/platforms.js";
import { PLATFORMS, PLATFORM_IDS } from "@appranks/shared";

describe("Platform routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: platformRoutes,
      prefix: "/api/platforms",
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // -----------------------------------------------------------------------
  // GET /api/platforms
  // -----------------------------------------------------------------------

  describe("GET /api/platforms", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({ method: "GET", url: "/api/platforms" });
      expect(res.statusCode).toBe(401);
    });

    it("returns all 12 platforms", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/platforms",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(PLATFORM_IDS.length);
      expect(body).toHaveLength(12);
    });

    it("each platform has the expected shape", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/platforms",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      for (const platform of body) {
        expect(platform).toHaveProperty("id");
        expect(platform).toHaveProperty("name");
        expect(platform).toHaveProperty("baseUrl");
        expect(platform).toHaveProperty("capabilities");

        const caps = platform.capabilities;
        expect(caps).toHaveProperty("hasKeywordSearch");
        expect(caps).toHaveProperty("hasReviews");
        expect(caps).toHaveProperty("hasFeaturedSections");
        expect(caps).toHaveProperty("hasAdTracking");
        expect(caps).toHaveProperty("hasSimilarApps");
        expect(caps).toHaveProperty("hasAutoSuggestions");
        expect(caps).toHaveProperty("hasFeatureTaxonomy");
      }
    });

    it("returns platform IDs matching PLATFORM_IDS constant", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/platforms",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      const returnedIds = body.map((p: any) => p.id);
      expect(returnedIds).toEqual([...PLATFORM_IDS]);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/platforms/:id
  // -----------------------------------------------------------------------

  describe("GET /api/platforms/:id", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/platforms/shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns a single platform by ID", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/platforms/shopify",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe("shopify");
      expect(body.name).toBe("Shopify App Store");
      expect(body.baseUrl).toBe("https://apps.shopify.com");
      expect(body.capabilities.hasKeywordSearch).toBe(true);
      expect(body.capabilities.hasReviews).toBe(true);
    });

    it("returns 404 for unknown platform ID", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/platforms/nonexistent",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Platform not found" });
    });

    it("returns correct capabilities for a platform without reviews", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/platforms/canva",
        headers: authHeaders(adminToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe("canva");
      expect(body.capabilities.hasReviews).toBe(false);
      expect(body.capabilities.hasKeywordSearch).toBe(true);
    });
  });
});
