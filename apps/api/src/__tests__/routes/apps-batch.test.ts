import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  userToken,
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

function postBatch(app: FastifyInstance, endpoint: string, slugs: string[], platform = "shopify") {
  return app.inject({
    method: "POST",
    url: `/api/apps/${endpoint}?platform=${platform}`,
    headers: authHeaders(userToken()),
    payload: { slugs },
  });
}

// ==========================================================================
// Batch endpoints with default (empty) mock DB
// ==========================================================================

describe("Batch endpoints — default empty DB", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildAppsApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // -----------------------------------------------------------------------
  // POST /api/apps/last-changes
  // -----------------------------------------------------------------------

  describe("POST /api/apps/last-changes", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/last-changes?platform=shopify",
        payload: { slugs: ["app-1"] },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when slugs is empty array", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/last-changes?platform=shopify",
        headers: authHeaders(userToken()),
        payload: { slugs: [] },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Validation failed");
    });

    it("returns 400 when slugs is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/last-changes?platform=shopify",
        headers: authHeaders(userToken()),
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when a slug is an empty string", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/last-changes?platform=shopify",
        headers: authHeaders(userToken()),
        payload: { slugs: [""] },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 200 with empty object for non-existent slugs", async () => {
      const res = await postBatch(app, "last-changes", ["nonexistent-app"]);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({});
    });

    it("returns 400 for invalid platform", async () => {
      const res = await postBatch(app, "last-changes", ["app-1"], "invalid_platform");
      expect(res.statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/apps/min-paid-prices
  // -----------------------------------------------------------------------

  describe("POST /api/apps/min-paid-prices", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/min-paid-prices?platform=shopify",
        payload: { slugs: ["app-1"] },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when slugs is empty array", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/min-paid-prices?platform=shopify",
        headers: authHeaders(userToken()),
        payload: { slugs: [] },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 200 with empty object for non-existent slugs", async () => {
      const res = await postBatch(app, "min-paid-prices", ["nonexistent-app"]);
      expect(res.statusCode).toBe(200);
      // execute returns [] so result is {}
      expect(res.json()).toEqual({});
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/apps/launched-dates
  // -----------------------------------------------------------------------

  describe("POST /api/apps/launched-dates", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/launched-dates?platform=shopify",
        payload: { slugs: ["app-1"] },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when slugs is empty array", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/launched-dates?platform=shopify",
        headers: authHeaders(userToken()),
        payload: { slugs: [] },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 200 with empty object for non-existent slugs", async () => {
      const res = await postBatch(app, "launched-dates", ["nonexistent-app"]);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({});
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/apps/categories
  // -----------------------------------------------------------------------

  describe("POST /api/apps/categories", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/categories?platform=shopify",
        payload: { slugs: ["app-1"] },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when slugs is empty array", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/categories?platform=shopify",
        headers: authHeaders(userToken()),
        payload: { slugs: [] },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 200 with empty object when no apps found", async () => {
      const res = await postBatch(app, "categories", ["nonexistent-app"]);
      expect(res.statusCode).toBe(200);
      // select returns [] for appRows, so appIdList is empty => returns {}
      expect(res.json()).toEqual({});
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/apps/reverse-similar-counts
  // -----------------------------------------------------------------------

  describe("POST /api/apps/reverse-similar-counts", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/reverse-similar-counts?platform=shopify",
        payload: { slugs: ["app-1"] },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when slugs is empty array", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/reverse-similar-counts?platform=shopify",
        headers: authHeaders(userToken()),
        payload: { slugs: [] },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 200 with empty object when no apps found", async () => {
      const res = await postBatch(app, "reverse-similar-counts", ["nonexistent-app"]);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({});
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/apps/featured-section-counts
  // -----------------------------------------------------------------------

  describe("POST /api/apps/featured-section-counts", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/featured-section-counts?platform=shopify",
        payload: { slugs: ["app-1"] },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when slugs is empty array", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/featured-section-counts?platform=shopify",
        headers: authHeaders(userToken()),
        payload: { slugs: [] },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 200 with empty object when no apps found", async () => {
      const res = await postBatch(app, "featured-section-counts", ["nonexistent-app"]);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({});
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/apps/ad-keyword-counts
  // -----------------------------------------------------------------------

  describe("POST /api/apps/ad-keyword-counts", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/ad-keyword-counts?platform=shopify",
        payload: { slugs: ["app-1"] },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when slugs is empty array", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/ad-keyword-counts?platform=shopify",
        headers: authHeaders(userToken()),
        payload: { slugs: [] },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 200 with empty object when no apps found", async () => {
      const res = await postBatch(app, "ad-keyword-counts", ["nonexistent-app"]);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({});
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/apps/review-velocity
  // -----------------------------------------------------------------------

  describe("POST /api/apps/review-velocity", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/review-velocity?platform=shopify",
        payload: { slugs: ["app-1"] },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when slugs is empty array", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/apps/review-velocity?platform=shopify",
        headers: authHeaders(userToken()),
        payload: { slugs: [] },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 200 with empty object for non-existent slugs", async () => {
      const res = await postBatch(app, "review-velocity", ["nonexistent-app"]);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({});
    });
  });

  // -----------------------------------------------------------------------
  // Cross-cutting: validation, platform scoping, large batches
  // -----------------------------------------------------------------------

  describe("Cross-cutting batch validation", () => {
    it("rejects slugs exceeding max limit (500)", async () => {
      const slugs = Array.from({ length: 501 }, (_, i) => `app-${i}`);
      const res = await postBatch(app, "last-changes", slugs);
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Validation failed");
    });

    it("accepts exactly 500 slugs (max limit)", async () => {
      const slugs = Array.from({ length: 500 }, (_, i) => `app-${i}`);
      const res = await postBatch(app, "last-changes", slugs);
      expect(res.statusCode).toBe(200);
    });

    it("handles large batch (50+ slugs) without error", async () => {
      const slugs = Array.from({ length: 55 }, (_, i) => `slug-${i}`);
      const res = await postBatch(app, "launched-dates", slugs);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({});
    });

    it("platform scoping — different platforms return independent results", async () => {
      const slugs = ["app-1"];
      const shopifyRes = await postBatch(app, "last-changes", slugs, "shopify");
      const wixRes = await postBatch(app, "last-changes", slugs, "wix");
      // Both should succeed with empty results from mock DB
      expect(shopifyRes.statusCode).toBe(200);
      expect(wixRes.statusCode).toBe(200);
    });

    it("platform scoping works for all batch endpoints", async () => {
      const endpoints = [
        "last-changes",
        "min-paid-prices",
        "launched-dates",
        "categories",
        "reverse-similar-counts",
        "featured-section-counts",
        "ad-keyword-counts",
        "review-velocity",
      ];
      for (const endpoint of endpoints) {
        const res = await postBatch(app, endpoint, ["app-1"], "salesforce");
        expect(res.statusCode).toBe(200);
      }
    });
  });
});

// ==========================================================================
// Batch endpoints with mock data — last-changes
// ==========================================================================

describe("POST /api/apps/last-changes — with data", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { appRoutes } = await import("../../routes/apps.js");
    app = await buildTestApp({
      routes: appRoutes,
      prefix: "/api/apps",
      db: {
        selectResult: [
          { appSlug: "oberlo", lastChangeAt: "2026-03-20T10:00:00Z" },
          { appSlug: "dsers", lastChangeAt: "2026-03-18T08:30:00Z" },
        ],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns lastChangeAt keyed by slug", async () => {
    const res = await postBatch(app, "last-changes", ["oberlo", "dsers"]);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({
      oberlo: "2026-03-20T10:00:00Z",
      dsers: "2026-03-18T08:30:00Z",
    });
  });

  it("result keys only include slugs that have changes", async () => {
    // Mock returns oberlo and dsers, even if we request more slugs
    const res = await postBatch(app, "last-changes", ["oberlo", "dsers", "no-changes-app"]);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // no-changes-app is not in the mock result, so it won't be in the output
    expect(body).not.toHaveProperty("no-changes-app");
    expect(Object.keys(body).length).toBe(2);
  });
});

// ==========================================================================
// Batch endpoints with mock data — min-paid-prices
// ==========================================================================

describe("POST /api/apps/min-paid-prices — with data", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { appRoutes } = await import("../../routes/apps.js");
    app = await buildTestApp({
      routes: appRoutes,
      prefix: "/api/apps",
      db: {
        // db.execute returns raw rows; the route does `(rows as any).rows ?? rows`
        executeResult: {
          rows: [
            {
              app_slug: "paid-app",
              pricing_plans: [
                { name: "Basic", price: "9.99" },
                { name: "Pro", price: "29.99" },
              ],
            },
            {
              app_slug: "free-app",
              pricing_plans: [{ name: "Free", price: "0" }],
            },
            {
              app_slug: "mixed-app",
              pricing_plans: [
                { name: "Free", price: "0" },
                { name: "Premium", price: "19.99" },
              ],
            },
            {
              app_slug: "no-plans-app",
              pricing_plans: null,
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns minimum paid price per slug", async () => {
    const res = await postBatch(app, "min-paid-prices", [
      "paid-app",
      "free-app",
      "mixed-app",
      "no-plans-app",
    ]);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // paid-app: min of 9.99 and 29.99 = 9.99
    expect(body["paid-app"]).toBe(9.99);
    // free-app: only plan is price "0", so no paid plans => 0 (all free)
    expect(body["free-app"]).toBe(0);
    // mixed-app: has a free plan (0) and a paid plan (19.99), min paid = 19.99
    expect(body["mixed-app"]).toBe(19.99);
    // no-plans-app: null pricing_plans => null
    expect(body["no-plans-app"]).toBeNull();
  });
});

// ==========================================================================
// Batch endpoints with mock data — launched-dates
// ==========================================================================

describe("POST /api/apps/launched-dates — with data", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { appRoutes } = await import("../../routes/apps.js");
    app = await buildTestApp({
      routes: appRoutes,
      prefix: "/api/apps",
      db: {
        selectResult: [
          { slug: "app-with-date", launchedDate: new Date("2023-06-15T00:00:00Z") },
          { slug: "app-no-date", launchedDate: null },
        ],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns launch date as ISO string or null", async () => {
    const res = await postBatch(app, "launched-dates", ["app-with-date", "app-no-date"]);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body["app-with-date"]).toBe("2023-06-15T00:00:00.000Z");
    expect(body["app-no-date"]).toBeNull();
  });
});

// ==========================================================================
// Batch endpoints with mock data — categories (with leaf filtering)
// ==========================================================================

describe("POST /api/apps/categories — with data", () => {
  let app: FastifyInstance;
  let selectCallCount: number;

  beforeAll(async () => {
    selectCallCount = 0;
    const { appRoutes } = await import("../../routes/apps.js");
    app = await buildTestApp({
      routes: appRoutes,
      prefix: "/api/apps",
      db: {
        // categories endpoint does two selects:
        //   1. app lookup (slug -> id)
        //   2. selectDistinctOn for category rankings
        // We use a Proxy to return different data per call
        selectResult: new Proxy([], {
          get(target, prop) {
            if (prop === "then") {
              selectCallCount++;
              if (selectCallCount % 2 === 1) {
                // First call: app lookup
                return (resolve: any) =>
                  resolve([{ id: 10, slug: "multi-cat-app" }]);
              }
              // Second call: category rankings with parent + leaf
              return (resolve: any) =>
                resolve([
                  {
                    appId: 10,
                    categorySlug: "marketing",
                    categoryTitle: "Marketing",
                    position: 5,
                  },
                  {
                    appId: 10,
                    categorySlug: "marketing-email",
                    categoryTitle: "Email marketing",
                    position: 3,
                  },
                  {
                    appId: 10,
                    categorySlug: "sales",
                    categoryTitle: "Sales",
                    position: 8,
                  },
                ]);
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

  it("returns leaf categories filtering out parent categories", async () => {
    const res = await postBatch(app, "categories", ["multi-cat-app"]);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("multi-cat-app");
    const cats = body["multi-cat-app"];
    // "marketing" should be filtered out because "marketing-email" starts with "marketing-"
    const slugs = cats.map((c: any) => c.slug);
    expect(slugs).not.toContain("marketing");
    expect(slugs).toContain("marketing-email");
    expect(slugs).toContain("sales");
  });

  it("each category has title, slug, and position", async () => {
    const res = await postBatch(app, "categories", ["multi-cat-app"]);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const cats = body["multi-cat-app"];
    for (const cat of cats) {
      expect(cat).toHaveProperty("title");
      expect(cat).toHaveProperty("slug");
      expect(cat).toHaveProperty("position");
    }
  });
});

// ==========================================================================
// Batch endpoints with mock data — categories skips position <= 0
// ==========================================================================

describe("POST /api/apps/categories — filters out invalid positions", () => {
  let app: FastifyInstance;
  let selectCallCount: number;

  beforeAll(async () => {
    selectCallCount = 0;
    const { appRoutes } = await import("../../routes/apps.js");
    app = await buildTestApp({
      routes: appRoutes,
      prefix: "/api/apps",
      db: {
        selectResult: new Proxy([], {
          get(target, prop) {
            if (prop === "then") {
              selectCallCount++;
              if (selectCallCount % 2 === 1) {
                return (resolve: any) =>
                  resolve([{ id: 20, slug: "pos-app" }]);
              }
              return (resolve: any) =>
                resolve([
                  { appId: 20, categorySlug: "good-cat", categoryTitle: "Good", position: 5 },
                  { appId: 20, categorySlug: "zero-cat", categoryTitle: "Zero", position: 0 },
                  { appId: 20, categorySlug: "neg-cat", categoryTitle: "Negative", position: -1 },
                ]);
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

  it("filters out categories with position <= 0", async () => {
    const res = await postBatch(app, "categories", ["pos-app"]);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const cats = body["pos-app"] || [];
    const slugs = cats.map((c: any) => c.slug);
    expect(slugs).toContain("good-cat");
    expect(slugs).not.toContain("zero-cat");
    expect(slugs).not.toContain("neg-cat");
  });
});

// ==========================================================================
// Batch endpoints with mock data — reverse-similar-counts
// ==========================================================================

describe("POST /api/apps/reverse-similar-counts — with data", () => {
  let app: FastifyInstance;
  let selectCallCount: number;

  beforeAll(async () => {
    selectCallCount = 0;
    const { appRoutes } = await import("../../routes/apps.js");
    app = await buildTestApp({
      routes: appRoutes,
      prefix: "/api/apps",
      db: {
        selectResult: new Proxy([], {
          get(target, prop) {
            if (prop === "then") {
              selectCallCount++;
              if (selectCallCount % 2 === 1) {
                // app lookup
                return (resolve: any) =>
                  resolve([
                    { id: 100, slug: "popular-app" },
                    { id: 101, slug: "niche-app" },
                  ]);
              }
              // similarity counts
              return (resolve: any) =>
                resolve([
                  { similarAppId: 100, count: 15 },
                  { similarAppId: 101, count: 2 },
                ]);
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

  it("returns count of apps that list each slug as similar", async () => {
    const res = await postBatch(app, "reverse-similar-counts", ["popular-app", "niche-app"]);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body["popular-app"]).toBe(15);
    expect(body["niche-app"]).toBe(2);
  });
});

// ==========================================================================
// Batch endpoints with mock data — featured-section-counts
// ==========================================================================

describe("POST /api/apps/featured-section-counts — with data", () => {
  let app: FastifyInstance;
  let selectCallCount: number;

  beforeAll(async () => {
    selectCallCount = 0;
    const { appRoutes } = await import("../../routes/apps.js");
    app = await buildTestApp({
      routes: appRoutes,
      prefix: "/api/apps",
      db: {
        selectResult: new Proxy([], {
          get(target, prop) {
            if (prop === "then") {
              selectCallCount++;
              if (selectCallCount % 2 === 1) {
                return (resolve: any) =>
                  resolve([{ id: 200, slug: "featured-app" }]);
              }
              return (resolve: any) =>
                resolve([{ appId: 200, sectionCount: 4 }]);
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

  it("returns distinct featured section count per slug", async () => {
    const res = await postBatch(app, "featured-section-counts", ["featured-app"]);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body["featured-app"]).toBe(4);
  });
});

// ==========================================================================
// Batch endpoints with mock data — ad-keyword-counts
// ==========================================================================

describe("POST /api/apps/ad-keyword-counts — with data", () => {
  let app: FastifyInstance;
  let selectCallCount: number;

  beforeAll(async () => {
    selectCallCount = 0;
    const { appRoutes } = await import("../../routes/apps.js");
    app = await buildTestApp({
      routes: appRoutes,
      prefix: "/api/apps",
      db: {
        selectResult: new Proxy([], {
          get(target, prop) {
            if (prop === "then") {
              selectCallCount++;
              if (selectCallCount % 2 === 1) {
                return (resolve: any) =>
                  resolve([{ id: 300, slug: "ad-heavy-app" }]);
              }
              return (resolve: any) =>
                resolve([{ appId: 300, keywordCount: 12 }]);
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

  it("returns distinct ad keyword count per slug", async () => {
    const res = await postBatch(app, "ad-keyword-counts", ["ad-heavy-app"]);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body["ad-heavy-app"]).toBe(12);
  });
});

// ==========================================================================
// Batch endpoints with mock data — review-velocity
// ==========================================================================

describe("POST /api/apps/review-velocity — with data", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { appRoutes } = await import("../../routes/apps.js");
    app = await buildTestApp({
      routes: appRoutes,
      prefix: "/api/apps",
      db: {
        executeResult: {
          rows: [
            {
              app_slug: "hot-app",
              v7d: 3.5,
              v30d: 2.1,
              v90d: 1.8,
              momentum: "accelerating",
            },
            {
              app_slug: "cold-app",
              v7d: 0,
              v30d: 0.2,
              v90d: 0.5,
              momentum: "decelerating",
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns velocity metrics keyed by slug", async () => {
    const res = await postBatch(app, "review-velocity", ["hot-app", "cold-app"]);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body["hot-app"]).toEqual({
      v7d: 3.5,
      v30d: 2.1,
      v90d: 1.8,
      momentum: "accelerating",
    });
    expect(body["cold-app"]).toEqual({
      v7d: 0,
      v30d: 0.2,
      v90d: 0.5,
      momentum: "decelerating",
    });
  });

  it("velocity response has v7d, v30d, v90d, momentum for each slug", async () => {
    const res = await postBatch(app, "review-velocity", ["hot-app"]);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const metrics = body["hot-app"];
    expect(metrics).toHaveProperty("v7d");
    expect(metrics).toHaveProperty("v30d");
    expect(metrics).toHaveProperty("v90d");
    expect(metrics).toHaveProperty("momentum");
  });
});

// ==========================================================================
// review-velocity — graceful when table doesn't exist (execute throws)
// ==========================================================================

describe("POST /api/apps/review-velocity — graceful on missing table", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { appRoutes } = await import("../../routes/apps.js");
    // Make execute throw to simulate missing table
    const mockDb: any = {
      select: () => {
        const c: any = {};
        const methods = [
          "select", "selectDistinctOn", "from", "where", "leftJoin", "innerJoin",
          "orderBy", "groupBy", "limit", "offset", "as", "having",
          "insert", "values", "returning", "onConflictDoUpdate", "onConflictDoNothing",
          "update", "set", "delete",
        ];
        for (const m of methods) c[m] = () => c;
        c.then = (resolve: any) => Promise.resolve([]).then(resolve);
        return c;
      },
      selectDistinctOn: () => {
        const c: any = {};
        const methods = [
          "select", "selectDistinctOn", "from", "where", "leftJoin", "innerJoin",
          "orderBy", "groupBy", "limit", "offset", "as", "having",
        ];
        for (const m of methods) c[m] = () => c;
        c.then = (resolve: any) => Promise.resolve([]).then(resolve);
        return c;
      },
      insert: () => {
        const c: any = {};
        c.values = () => c;
        c.returning = () => c;
        c.then = (resolve: any) => Promise.resolve([]).then(resolve);
        return c;
      },
      update: () => {
        const c: any = {};
        c.set = () => c;
        c.where = () => c;
        c.then = (resolve: any) => Promise.resolve([]).then(resolve);
        return c;
      },
      delete: () => {
        const c: any = {};
        c.where = () => c;
        c.then = (resolve: any) => Promise.resolve([]).then(resolve);
        return c;
      },
      execute: () => Promise.reject(new Error('relation "app_review_metrics" does not exist')),
      query: () => Promise.resolve([]),
      transaction: async (fn: any) => fn(mockDb),
    };

    app = await buildTestApp({
      routes: appRoutes,
      prefix: "/api/apps",
      db: {}, // won't be used, we override below
    });
    // Patch the db on the instance after build
    (app as any).db = mockDb;
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns empty object when execute throws (table missing)", async () => {
    const res = await postBatch(app, "review-velocity", ["some-app"]);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({});
  });
});
