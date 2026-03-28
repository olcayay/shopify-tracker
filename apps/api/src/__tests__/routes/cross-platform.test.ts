import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  userToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";
import { crossPlatformRoutes } from "../../routes/cross-platform.js";

describe("Cross-platform routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: crossPlatformRoutes,
      prefix: "/api/cross-platform",
      db: {
        selectResult: [],
        executeResult: [{ count: "0" }],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // -----------------------------------------------------------------------
  // GET /api/cross-platform/apps
  // -----------------------------------------------------------------------
  describe("GET /api/cross-platform/apps", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/cross-platform/apps",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns apps with pagination", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/cross-platform/apps",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("items");
      expect(body).toHaveProperty("pagination");
      expect(body.pagination).toHaveProperty("page");
      expect(body.pagination).toHaveProperty("limit");
      expect(body.pagination).toHaveProperty("total");
      expect(body.pagination).toHaveProperty("totalPages");
    });

    it("accepts search and platform filter parameters", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/cross-platform/apps?search=test&platforms=shopify,salesforce&page=1&limit=10",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
    });

    it("returns empty items when no enabled platforms", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/cross-platform/apps",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.items).toEqual([]);
      expect(body.pagination.total).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/cross-platform/keywords
  // -----------------------------------------------------------------------
  describe("GET /api/cross-platform/keywords", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/cross-platform/keywords",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns keywords with pagination", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/cross-platform/keywords",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("items");
      expect(body).toHaveProperty("pagination");
    });

    it("accepts search and sort parameters", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/cross-platform/keywords?search=crm&sort=platform&order=desc",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
    });

    it("returns empty when no tracked keywords", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/cross-platform/keywords",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      expect(body.items).toEqual([]);
      expect(body.pagination.total).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/cross-platform/competitors
  // -----------------------------------------------------------------------
  describe("GET /api/cross-platform/competitors", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/cross-platform/competitors",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns competitors with pagination", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/cross-platform/competitors",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("items");
      expect(body).toHaveProperty("pagination");
    });

    it("accepts platform filter and sort", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/cross-platform/competitors?platforms=shopify&sort=rating&order=desc",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
    });

    it("returns empty when no competitors", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/cross-platform/competitors",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      expect(body.items).toEqual([]);
      expect(body.pagination.total).toBe(0);
    });
  });
});
