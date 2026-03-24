import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  createMockDb,
  userToken,
  adminToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";
import { featureRoutes } from "../../routes/features.js";

// ---------------------------------------------------------------------------
// Sample data for the mock DB
// ---------------------------------------------------------------------------

const sampleTreeRows = [
  {
    category_title: "Store management",
    subcategory_title: "Inventory",
    feature_handle: "inventory-sync",
    feature_title: "Inventory sync",
  },
  {
    category_title: "Store management",
    subcategory_title: "Inventory",
    feature_handle: "stock-alerts",
    feature_title: "Stock alerts",
  },
  {
    category_title: "Marketing",
    subcategory_title: "Email",
    feature_handle: "email-campaigns",
    feature_title: "Email campaigns",
  },
];

const sampleSearchRows = [
  { handle: "inventory-sync", title: "Inventory sync" },
  { handle: "stock-alerts", title: "Stock alerts" },
];

const sampleFeatureDetail = [
  {
    handle: "inventory-sync",
    title: "Inventory sync",
    category_title: "Store management",
    subcategory_title: "Inventory",
  },
];

describe("Feature routes", () => {
  // -----------------------------------------------------------------------
  // GET /api/features/tree
  // -----------------------------------------------------------------------

  describe("GET /api/features/tree", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildTestApp({
        routes: featureRoutes,
        prefix: "/api/features",
        db: { executeResult: sampleTreeRows },
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/features/tree",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns a hierarchical tree of features", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/features/tree",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();

      // Two top-level categories from sample data
      expect(body).toHaveLength(2);
      expect(body[0].title).toBe("Store management");
      expect(body[1].title).toBe("Marketing");
    });

    it("groups subcategories under their parent category", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/features/tree",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      const storeMgmt = body.find(
        (c: any) => c.title === "Store management"
      );
      expect(storeMgmt).toBeDefined();
      expect(storeMgmt.subcategories).toHaveLength(1);
      expect(storeMgmt.subcategories[0].title).toBe("Inventory");
      expect(storeMgmt.subcategories[0].features).toHaveLength(2);
    });

    it("each feature has handle and title", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/features/tree",
        headers: authHeaders(userToken()),
      });

      const body = res.json();
      const features = body[0].subcategories[0].features;
      for (const f of features) {
        expect(f).toHaveProperty("handle");
        expect(f).toHaveProperty("title");
      }
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/features/search?q=
  // -----------------------------------------------------------------------

  describe("GET /api/features/search", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildTestApp({
        routes: featureRoutes,
        prefix: "/api/features",
        db: { executeResult: sampleSearchRows },
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/features/search?q=inv",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns matching features for a query", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/features/search?q=inv",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
      expect(body[0]).toHaveProperty("handle");
      expect(body[0]).toHaveProperty("title");
    });

    it("returns empty array when q is missing", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/features/search",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns empty array when q is empty string", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/features/search?q=",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/features/by-category
  // -----------------------------------------------------------------------

  describe("GET /api/features/by-category", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildTestApp({
        routes: featureRoutes,
        prefix: "/api/features",
        db: {
          executeResult: [
            {
              handle: "email-campaigns",
              title: "Email campaigns",
              category_title: "Marketing",
              subcategory_title: "Email",
            },
          ],
        },
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it("returns empty array when no category or subcategory provided", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/features/by-category",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns features filtered by category", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/features/by-category?category=Marketing",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });
});
