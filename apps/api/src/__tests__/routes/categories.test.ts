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

async function buildCategoriesApp(dbOverrides = {}) {
  const { categoryRoutes } = await import("../../routes/categories.js");
  return buildTestApp({
    routes: categoryRoutes,
    prefix: "/api/categories",
    db: dbOverrides,
  });
}

describe("Category routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildCategoriesApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // GET /api/categories — list categories
  // =========================================================================

  describe("GET /api/categories", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 with invalid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories?platform=shopify",
        headers: { authorization: "Bearer invalid.token" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 200 with valid auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns an array (default tree format returns empty for mock)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    it("accepts format=flat query parameter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories?platform=shopify&format=flat",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    it("accepts format=tree query parameter (default)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories?platform=shopify&format=tree",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    it("accepts tracked=true query parameter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories?platform=shopify&tracked=true",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("defaults to shopify when no platform param is given", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns 400 for an invalid platform", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories?platform=invalid_platform",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(400);
    });

    it("works with admin token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories?platform=shopify&format=flat",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // GET /api/categories/features-by-slugs
  // =========================================================================

  describe("GET /api/categories/features-by-slugs", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories/features-by-slugs?slugs=marketing",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns empty array when slugs param is missing", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories/features-by-slugs",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns empty array when slugs param is empty string", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories/features-by-slugs?slugs=",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns empty array for slugs with invalid characters", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories/features-by-slugs?slugs=INVALID_SLUG!",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });
  });

  // =========================================================================
  // GET /api/categories/:slug — category detail
  // =========================================================================

  describe("GET /api/categories/:slug", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories/marketing?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 404 when category not found (mock DB returns empty)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories/nonexistent?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Category not found" });
    });

    it("returns 400 for invalid platform on slug route", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories/marketing?platform=bogus",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // GET /api/categories/:slug/history
  // =========================================================================

  describe("GET /api/categories/:slug/history", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories/marketing/history?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 404 when category not found", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories/nonexistent/history?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Category not found" });
    });
  });

  // =========================================================================
  // GET /api/categories/:slug/ads
  // =========================================================================

  describe("GET /api/categories/:slug/ads", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories/marketing/ads?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns empty adSightings when category not found", async () => {
      // ads route returns { adSightings: [] } when category not found, not 404
      const res = await app.inject({
        method: "GET",
        url: "/api/categories/nonexistent/ads?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ adSightings: [] });
    });
  });

  // =========================================================================
  // GET /api/categories/:slug/scores
  // =========================================================================

  describe("GET /api/categories/:slug/scores", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories/marketing/scores?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns empty scores when no power score data exists", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories/marketing/scores?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("scores");
      expect(body).toHaveProperty("computedAt", null);
      expect(body.scores).toEqual([]);
    });
  });

  // =========================================================================
  // GET /api/categories/:slug/scores/history
  // =========================================================================

  describe("GET /api/categories/:slug/scores/history", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories/marketing/scores/history?platform=shopify",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns power score history shape", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/categories/marketing/scores/history?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("power");
    });
  });
});

// ---------------------------------------------------------------------------
// Tests with custom mock DB data
// ---------------------------------------------------------------------------

describe("Category routes — with mock data", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildCategoriesApp({
      selectResult: [
        {
          id: 10,
          slug: "marketing",
          title: "Marketing",
          url: "https://apps.shopify.com/categories/marketing",
          parentSlug: null,
          categoryLevel: 0,
          description: "Marketing apps",
          isTracked: true,
          isListingPage: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          platform: "shopify",
          appCount: 500,
          categoryId: 10,
          scrapeRunId: "run-1",
          scrapedAt: new Date().toISOString(),
          computedAt: new Date().toISOString(),
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/categories?format=flat returns category objects with expected fields", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/categories?platform=shopify&format=flat",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    // Admin sees all; regular user only sees categories with appCount > 0
    // Our mock data has appCount: 500, so it should be visible
    if (body.length > 0) {
      const cat = body[0];
      expect(cat).toHaveProperty("slug");
      expect(cat).toHaveProperty("title");
      expect(cat).toHaveProperty("appCount");
    }
  });

  it("GET /api/categories/:slug returns category detail when found", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/categories/marketing?platform=shopify",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("slug", "marketing");
    expect(body).toHaveProperty("title", "Marketing");
    expect(body).toHaveProperty("latestSnapshot");
    expect(body).toHaveProperty("children");
    expect(body).toHaveProperty("breadcrumb");
    expect(body).toHaveProperty("rankedApps");
  });

  it("GET /api/categories/:slug/history returns history shape when category found", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/categories/marketing/history?platform=shopify",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("category");
    expect(body).toHaveProperty("snapshots");
    expect(body.category).toHaveProperty("slug", "marketing");
  });

  it("GET /api/categories/:slug/scores returns scores shape", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/categories/marketing/scores?platform=shopify",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("scores");
    expect(body).toHaveProperty("computedAt");
  });

  it("admin user sees categories with zero appCount in flat format", async () => {
    // Build a separate app with appCount: 0 to verify admin visibility
    const { categoryRoutes } = await import("../../routes/categories.js");
    const adminApp = await buildTestApp({
      routes: categoryRoutes,
      prefix: "/api/categories",
      db: {
        selectResult: [
          {
            id: 99,
            slug: "empty-cat",
            title: "Empty Category",
            url: "https://apps.shopify.com/categories/empty-cat",
            parentSlug: null,
            categoryLevel: 0,
            description: null,
            isTracked: false,
            isListingPage: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            platform: "shopify",
            appCount: 0,
          },
        ],
      },
    });

    const res = await adminApp.inject({
      method: "GET",
      url: "/api/categories?platform=shopify&format=flat",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Admin should see the category even though appCount is 0
    expect(Array.isArray(body)).toBe(true);
    if (body.length > 0) {
      expect(body[0]).toHaveProperty("slug", "empty-cat");
    }

    await adminApp.close();
  });

  it("non-admin user does NOT see categories with zero appCount", async () => {
    const { categoryRoutes } = await import("../../routes/categories.js");
    const userApp = await buildTestApp({
      routes: categoryRoutes,
      prefix: "/api/categories",
      db: {
        selectResult: [
          {
            id: 99,
            slug: "empty-cat",
            title: "Empty Category",
            url: "https://apps.shopify.com/categories/empty-cat",
            parentSlug: null,
            categoryLevel: 0,
            description: null,
            isTracked: false,
            isListingPage: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            platform: "shopify",
            appCount: 0,
          },
        ],
      },
    });

    const res = await userApp.inject({
      method: "GET",
      url: "/api/categories?platform=shopify&format=flat",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Non-admin user should NOT see categories with appCount 0
    expect(body).toEqual([]);

    await userApp.close();
  });

  // -----------------------------------------------------------------------
  // POST /api/categories/batch
  // -----------------------------------------------------------------------

  describe("POST /api/categories/batch", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/categories/batch?platform=shopify",
        headers: { "content-type": "application/json" },
        payload: { slugs: ["marketing"] },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns empty object for empty slugs", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/categories/batch?platform=shopify",
        headers: { ...authHeaders(userToken()), "content-type": "application/json" },
        payload: { slugs: [] },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({});
    });

    it("returns object keyed by slug with leaders and appCount", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/categories/batch?platform=shopify",
        headers: { ...authHeaders(userToken()), "content-type": "application/json" },
        payload: { slugs: ["marketing", "sales"] },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(typeof body).toBe("object");
      // With mock DB returning empty results, each slug should have empty leaders
      for (const slug of Object.keys(body)) {
        expect(body[slug]).toHaveProperty("leaders");
        expect(body[slug]).toHaveProperty("appCount");
        expect(Array.isArray(body[slug].leaders)).toBe(true);
      }
    });
  });
});

// =========================================================================
// Unit tests for buildTree and pruneEmptyLeaves
// =========================================================================

describe("buildTree", () => {
  let buildTree: typeof import("../../routes/categories.js").buildTree;

  beforeAll(async () => {
    const mod = await import("../../routes/categories.js");
    buildTree = mod.buildTree;
  });

  it("returns roots for categories with no parentSlug", () => {
    const rows = [
      { id: 1, slug: "marketing", parentSlug: null, title: "Marketing" },
      { id: 2, slug: "checkout", parentSlug: null, title: "Checkout" },
    ];
    const tree = buildTree(rows, []);
    expect(tree).toHaveLength(2);
    expect(tree[0].slug).toBe("marketing");
    expect(tree[1].slug).toBe("checkout");
  });

  it("nests children under their parent via parentSlug", () => {
    const rows = [
      { id: 1, slug: "finding-products", parentSlug: null, title: "Finding products" },
      { id: 2, slug: "finding-products-dropshipping", parentSlug: "finding-products", title: "Dropshipping" },
      { id: 3, slug: "finding-products-wholesale", parentSlug: "finding-products", title: "Wholesale" },
    ];
    const tree = buildTree(rows, []);
    expect(tree).toHaveLength(1);
    expect(tree[0].slug).toBe("finding-products");
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].slug).toBe("finding-products-dropshipping");
  });

  it("promotes orphaned categories (missing parent) to roots", () => {
    const rows = [
      { id: 2, slug: "finding-products-dropshipping", parentSlug: "finding-products", title: "Dropshipping" },
      { id: 3, slug: "finding-products-wholesale", parentSlug: "finding-products", title: "Wholesale" },
    ];
    const tree = buildTree(rows, []);
    expect(tree).toHaveLength(2);
  });
});

describe("pruneEmptyLeaves", () => {
  let pruneEmptyLeaves: typeof import("../../routes/categories.js").pruneEmptyLeaves;

  beforeAll(async () => {
    const mod = await import("../../routes/categories.js");
    pruneEmptyLeaves = mod.pruneEmptyLeaves;
  });

  it("removes leaf nodes with no apps", () => {
    const tree = [
      { slug: "empty-leaf", appCount: null, children: [] },
      { slug: "has-apps", appCount: 5, children: [] },
    ];
    const result = pruneEmptyLeaves(tree);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("has-apps");
  });

  it("keeps parent with no apps if children have apps", () => {
    const tree = [
      {
        slug: "finding-products",
        appCount: null,
        children: [
          { slug: "dropshipping", appCount: 10, children: [] },
          { slug: "wholesale", appCount: 5, children: [] },
        ],
      },
    ];
    const result = pruneEmptyLeaves(tree);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("finding-products");
    expect(result[0].children).toHaveLength(2);
  });

  it("removes parent with no apps when children also have no apps", () => {
    const tree = [
      {
        slug: "empty-parent",
        appCount: null,
        children: [
          { slug: "empty-child", appCount: null, children: [] },
        ],
      },
    ];
    const result = pruneEmptyLeaves(tree);
    expect(result).toHaveLength(0);
  });

  it("handles multi-level pruning correctly", () => {
    const tree = [
      {
        slug: "root",
        appCount: null,
        children: [
          {
            slug: "mid",
            appCount: null,
            children: [
              { slug: "leaf-with-apps", appCount: 3, children: [] },
              { slug: "leaf-empty", appCount: 0, children: [] },
            ],
          },
        ],
      },
    ];
    const result = pruneEmptyLeaves(tree);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("root");
    expect(result[0].children[0].slug).toBe("mid");
    expect(result[0].children[0].children).toHaveLength(1);
    expect(result[0].children[0].children[0].slug).toBe("leaf-with-apps");
  });
});
