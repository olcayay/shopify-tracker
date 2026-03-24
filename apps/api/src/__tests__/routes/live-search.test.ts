import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  buildTestApp,
  createMockDb,
  userToken,
  adminToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";

// Mock global fetch so platform-specific live searches don't make real HTTP calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Live search routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { liveSearchRoutes } = await import(
      "../../routes/live-search.js"
    );

    app = await buildTestApp({
      routes: liveSearchRoutes,
      prefix: "/api/live-search",
      db: {
        executeResult: [],
      },
    });
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Auth enforcement
  // -----------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 without auth header", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=test",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 with invalid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=test",
        headers: { authorization: "Bearer invalid-token" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 200 with valid user token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html></html>",
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=test",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns 200 with valid admin token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html></html>",
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=test",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Input validation
  // -----------------------------------------------------------------------

  describe("input validation", () => {
    it("returns 400 when q parameter is missing", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: "q parameter is required" });
    });

    it("returns 400 when q parameter is empty string", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: "q parameter is required" });
    });

    it("returns 400 for invalid platform", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=nonexistent&q=test",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(400);
    });

    it("defaults to shopify when platform is not provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html></html>",
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?q=test",
        headers: authHeaders(userToken()),
      });
      // Should succeed (defaults to shopify scraping)
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Platform routing - Shopify (default)
  // -----------------------------------------------------------------------

  describe("Shopify search (default)", () => {
    it("returns search results on success", async () => {
      const html = `
        <html><body>
          <div>42 results for test</div>
          <div data-controller="app-card"
               data-app-card-handle-value="my-app"
               data-app-card-name-value="My App"
               data-app-card-app-link-value="/apps/my-app">
            <p>A great app for testing purposes and doing stuff</p>
            <span>4.5 out of 5 stars</span>
            <span>(100) 100 total reviews</span>
          </div>
        </body></html>
      `;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => html,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=test",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("keyword", "test");
      expect(body).toHaveProperty("totalResults");
      expect(body).toHaveProperty("apps");
      expect(Array.isArray(body.apps)).toBe(true);
    });

    it("returns 502 when Shopify returns non-OK status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=test",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(502);
      expect(res.json()).toHaveProperty("error");
    });

    it("returns 502 when fetch throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=test",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(502);
      expect(res.json().error).toContain("Failed to fetch from Shopify");
    });
  });

  // -----------------------------------------------------------------------
  // Platform routing - Salesforce
  // -----------------------------------------------------------------------

  describe("Salesforce search", () => {
    it("returns results from Salesforce API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalCount: 5,
          listings: [
            {
              oafId: "sf-app-1",
              title: "SF App",
              description: "A Salesforce app",
              averageRating: 4.2,
              reviewsAmount: 30,
              logos: [{ logoType: "Logo", mediaId: "logo-url" }],
            },
          ],
          featured: [],
        }),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=salesforce&q=crm",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.keyword).toBe("crm");
      expect(body.totalResults).toBe(5);
      expect(body.apps).toHaveLength(1);
      expect(body.apps[0].app_slug).toBe("sf-app-1");
      expect(body.apps[0].app_name).toBe("SF App");
      expect(body.apps[0].is_sponsored).toBe(false);
    });

    it("returns 502 when Salesforce API fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=salesforce&q=crm",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(502);
      expect(res.json().error).toContain("Salesforce");
    });
  });

  // -----------------------------------------------------------------------
  // Platform routing - DB-based platforms
  // -----------------------------------------------------------------------

  describe("database-based platform search", () => {
    it("google_workspace uses database search and returns source field", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=google_workspace&q=mail",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.keyword).toBe("mail");
      expect(body.source).toBe("database");
      expect(body).toHaveProperty("totalResults");
      expect(body).toHaveProperty("apps");
    });

    it("zoho uses database search and returns source field", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=zoho&q=crm",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.keyword).toBe("crm");
      expect(body.source).toBe("database");
    });

    it("zendesk uses database search and returns source field", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=zendesk&q=slack",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.keyword).toBe("slack");
      expect(body.source).toBe("database");
    });
  });

  // -----------------------------------------------------------------------
  // Response shape
  // -----------------------------------------------------------------------

  describe("response shape", () => {
    it("returns keyword, totalResults, and apps array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html></html>",
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/live-search?platform=shopify&q=inventory",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("keyword");
      expect(body).toHaveProperty("totalResults");
      expect(body).toHaveProperty("apps");
      expect(Array.isArray(body.apps)).toBe(true);
    });
  });
});
