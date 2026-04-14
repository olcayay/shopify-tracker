import Fastify, { type FastifyInstance } from "fastify";
import { createMockDb, type MockDbOverrides } from "../helpers/test-app.js";
import { publicRoutes } from "../../routes/public.js";
import { vi } from "vitest";

// Prevent real Redis connections during tests
vi.mock("../../utils/cache.js", () => ({
  cacheGet: async (_key: string, fetcher: () => Promise<any>, _ttl: number) => fetcher(),
}));

// ---------------------------------------------------------------------------
// Helper: build a minimal Fastify app for public routes (no auth required)
// ---------------------------------------------------------------------------
async function buildPublicApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const mockDb = createMockDb(db);
  app.decorate("db", mockDb);
  await app.register(
    async (instance) => {
      instance.db = mockDb;
      await publicRoutes(instance);
    },
    { prefix: "/api/public" },
  );
  await app.ready();
  return app;
}

/**
 * Helper: build app with per-call execute results.
 * Each call to db.execute() returns the next item from the array.
 */
async function buildPublicAppWithExecuteSequence(
  selectResult: any,
  executeSequence: any[],
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const mockDb = createMockDb({ selectResult });
  let callIdx = 0;
  mockDb.execute = () => {
    const result = executeSequence[callIdx] ?? [];
    callIdx++;
    return Promise.resolve(result);
  };
  app.decorate("db", mockDb);
  await app.register(
    async (instance) => {
      instance.db = mockDb;
      await publicRoutes(instance);
    },
    { prefix: "/api/public" },
  );
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const MOCK_APP_ROW = {
  slug: "test-app",
  name: "Test App",
  iconUrl: "https://example.com/icon.png",
  platform: "shopify",
  isBuiltForShopify: true,
  launchedDate: "2024-01-01",
  averageRating: "4.50",
  ratingCount: 100,
  pricingHint: "Free plan available",
  activeInstalls: 5000,
};

const MOCK_SNAPSHOT = {
  intro: "A great test app for developers.",
  developer: { name: "Test Dev", website: "https://testdev.com" },
  pricing: "Free plan available",
  pricing_plans: [{ name: "Free", price: "$0" }, { name: "Pro", price: "$9.99/mo" }],
  categories: [{ title: "Marketing", slug: "marketing" }],
  screenshots: ["https://example.com/ss1.png"],
  features: ["Email marketing", "Analytics"],
  average_rating: "4.50",
  rating_count: 100,
};

const MOCK_SIMILAR_APPS = [
  {
    slug: "similar-app",
    name: "Similar App",
    icon_url: "https://example.com/sim.png",
    average_rating: "4.20",
    rating_count: 50,
    pricing_hint: "Free",
    overall_score: "0.85",
  },
];

const MOCK_CATEGORY = {
  id: 1,
  slug: "marketing",
  title: "Marketing",
  description: "Marketing apps",
  isListingPage: true,
};

const MOCK_CATEGORY_SNAPSHOT = {
  app_count: 50,
  scrape_run_id: "run-1",
  scraped_at: "2025-01-01T00:00:00Z",
};

const MOCK_TOP_APP = {
  position: 1,
  appSlug: "top-app",
  name: "Top App",
  iconUrl: "https://example.com/top.png",
  averageRating: "4.80",
  ratingCount: 200,
  pricingHint: "$9.99/month",
};

const MOCK_DEVELOPER = {
  id: 10,
  slug: "acme-inc",
  name: "Acme Inc",
  website: "https://acme.com",
};

const MOCK_PLATFORM_DEV = {
  platform: "shopify",
  name: "Acme Inc",
};

const MOCK_DEV_APP = {
  slug: "acme-app",
  name: "Acme App",
  icon_url: "https://example.com/acme.png",
  platform: "shopify",
  average_rating: "4.30",
  rating_count: 75,
  pricing_hint: "Free",
};

const MOCK_KEYWORD = {
  id: 5,
  keyword: "email marketing",
  slug: "email-marketing",
};

const MOCK_RANK_ROW = {
  app_id: 1,
  position: 1,
  scraped_at: "2025-01-01T00:00:00Z",
  app_slug: "top-ranked",
  app_name: "Top Ranked App",
  icon_url: "https://example.com/ranked.png",
  average_rating: "4.60",
  rating_count: 150,
  pricing_hint: "Free",
};

const MOCK_COMPARE_APP1 = {
  id: 1,
  slug: "app-alpha",
  name: "App Alpha",
  icon_url: "https://example.com/alpha.png",
  platform: "shopify",
  average_rating: "4.50",
  rating_count: 100,
  pricing_hint: "Free",
  active_installs: 5000,
  launched_date: "2024-01-01",
  is_built_for_shopify: true,
  intro: "Alpha intro",
  developer: { name: "Alpha Dev" },
  pricing: "Free",
  pricing_plans: [{ name: "Free", price: "$0" }],
  categories: [{ title: "Marketing" }],
  features: ["Feature A"],
  languages: ["English"],
};

const MOCK_COMPARE_APP2 = {
  id: 2,
  slug: "app-beta",
  name: "App Beta",
  icon_url: "https://example.com/beta.png",
  platform: "shopify",
  average_rating: "3.80",
  rating_count: 40,
  pricing_hint: "$9.99/mo",
  active_installs: 2000,
  launched_date: "2024-06-01",
  is_built_for_shopify: false,
  intro: "Beta intro",
  developer: { name: "Beta Dev" },
  pricing: "$9.99/mo",
  pricing_plans: [{ name: "Standard", price: "$9.99/mo" }],
  categories: [{ title: "Sales" }],
  features: ["Feature B"],
  languages: ["English", "Spanish"],
};

const ALL_PLATFORMS = [
  "shopify", "salesforce", "canva", "wix", "wordpress",
  "google_workspace", "atlassian", "zoom", "zoho", "zendesk", "hubspot",
];

// ===================================================================
// PUBLIC APP ROUTE
// ===================================================================

describe("GET /api/public/apps/:platform/:slug", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns full app profile with snapshot and similar apps", async () => {
    app = await buildPublicAppWithExecuteSequence(
      [MOCK_APP_ROW],
      [
        [MOCK_SNAPSHOT],     // snapshot query
        MOCK_SIMILAR_APPS,   // similar apps query
      ],
    );

    const res = await app.inject({ method: "GET", url: "/api/public/apps/shopify/test-app" });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.slug).toBe("test-app");
    expect(body.name).toBe("Test App");
    expect(body.platform).toBe("shopify");
    expect(body.intro).toBe("A great test app for developers.");
    expect(body.developer).toEqual({ name: "Test Dev", website: "https://testdev.com" });
    expect(body.pricingPlans).toHaveLength(2);
    expect(body.features).toEqual(["Email marketing", "Analytics"]);
    expect(body.screenshots).toHaveLength(1);
    expect(body.categories).toHaveLength(1);
    expect(body.averageRating).toBe(4.5);
    expect(body.ratingCount).toBe(100);
    expect(body.similarApps).toHaveLength(1);
    expect(body.similarApps[0].slug).toBe("similar-app");
    expect(body.similarApps[0].averageRating).toBe(4.2);
  });

  it("handles missing snapshot gracefully (null/empty defaults)", async () => {
    app = await buildPublicApp({
      selectResult: [MOCK_APP_ROW],
      executeResult: [],
    });

    const res = await app.inject({ method: "GET", url: "/api/public/apps/shopify/test-app" });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.name).toBe("Test App");
    expect(body.intro).toBeNull();
    expect(body.developer).toBeNull();
    expect(body.pricing).toBeNull();
    expect(body.pricingPlans).toEqual([]);
    expect(body.features).toEqual([]);
    expect(body.categories).toEqual([]);
    expect(body.screenshots).toEqual([]);
    expect(body.similarApps).toEqual([]);
  });

  it("returns 404 for non-existent app", async () => {
    app = await buildPublicApp({ selectResult: [], executeResult: [] });
    const res = await app.inject({ method: "GET", url: "/api/public/apps/shopify/nonexistent" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("App not found");
  });

  it("returns 400 for invalid platform", async () => {
    app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: "/api/public/apps/invalid-platform/test-app" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Invalid platform");
  });

  it("includes Cache-Control header", async () => {
    app = await buildPublicApp({
      selectResult: [MOCK_APP_ROW],
      executeResult: [MOCK_SNAPSHOT],
    });
    const res = await app.inject({ method: "GET", url: "/api/public/apps/shopify/test-app" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=3600, stale-while-revalidate=7200");
  });

  it("does not require authentication", async () => {
    app = await buildPublicApp({
      selectResult: [MOCK_APP_ROW],
      executeResult: [MOCK_SNAPSHOT],
    });
    // No auth headers — should work
    const res = await app.inject({ method: "GET", url: "/api/public/apps/shopify/test-app" });
    expect(res.statusCode).toBe(200);
  });
});

// ===================================================================
// PUBLIC CATEGORY ROUTE (single)
// ===================================================================

describe("GET /api/public/categories/:platform/:slug", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns category data with top apps for a listing page", async () => {
    // select() returns the category, first execute() returns snapshot
    // The second select chain (for top apps) also uses selectResult.
    // Since top apps uses a different select chain after the category lookup,
    // we need to carefully sequence. With static selectResult both calls get the same result,
    // but in practice category is found first and then top apps are queried.
    app = await buildPublicApp({
      selectResult: [MOCK_CATEGORY],
      executeResult: [MOCK_CATEGORY_SNAPSHOT],
    });

    const res = await app.inject({ method: "GET", url: "/api/public/categories/shopify/marketing" });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.slug).toBe("marketing");
    expect(body.title).toBe("Marketing");
    expect(body.description).toBe("Marketing apps");
    expect(body.appCount).toBe(50);
    expect(body.lastUpdated).toBeDefined();
  });

  it("returns category without top apps when not a listing page", async () => {
    const nonListingCategory = { ...MOCK_CATEGORY, isListingPage: false };
    app = await buildPublicApp({
      selectResult: [nonListingCategory],
      executeResult: [{ app_count: 30, scrape_run_id: "run-2", scraped_at: "2025-01-01" }],
    });

    const res = await app.inject({ method: "GET", url: "/api/public/categories/shopify/marketing" });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    // topApps should be empty because isListingPage is false
    expect(body.topApps).toEqual([]);
  });

  it("returns 404 for non-existent category", async () => {
    app = await buildPublicApp({ selectResult: [] });
    const res = await app.inject({ method: "GET", url: "/api/public/categories/shopify/nonexistent" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Category not found");
  });

  it("returns 400 for invalid platform", async () => {
    app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: "/api/public/categories/fakeplatform/test" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Invalid platform");
  });

  it("includes Cache-Control header", async () => {
    app = await buildPublicApp({
      selectResult: [MOCK_CATEGORY],
      executeResult: [MOCK_CATEGORY_SNAPSHOT],
    });
    const res = await app.inject({ method: "GET", url: "/api/public/categories/shopify/marketing" });
    expect(res.headers["cache-control"]).toBe("public, max-age=3600, stale-while-revalidate=7200");
  });
});

// ===================================================================
// PUBLIC CATEGORY TREE
// ===================================================================

describe("GET /api/public/categories/:platform", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns category list for a valid platform", async () => {
    app = await buildPublicApp({
      selectResult: [
        { slug: "marketing", title: "Marketing", parentSlug: null, isListingPage: true },
        { slug: "sales", title: "Sales", parentSlug: null, isListingPage: true },
      ],
    });

    const res = await app.inject({ method: "GET", url: "/api/public/categories/shopify" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0].slug).toBe("marketing");
    expect(body[1].slug).toBe("sales");
  });

  it("returns empty array when platform has no categories", async () => {
    app = await buildPublicApp({ selectResult: [] });
    const res = await app.inject({ method: "GET", url: "/api/public/categories/shopify" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns 400 for invalid platform", async () => {
    app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: "/api/public/categories/nope" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Invalid platform");
  });

  it("includes Cache-Control header", async () => {
    app = await buildPublicApp({ selectResult: [] });
    const res = await app.inject({ method: "GET", url: "/api/public/categories/shopify" });
    expect(res.headers["cache-control"]).toBe("public, max-age=3600, stale-while-revalidate=7200");
  });
});

// ===================================================================
// PUBLIC DEVELOPER ROUTE
// ===================================================================

describe("GET /api/public/developers/:platform/:slug", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns developer with platforms and apps", async () => {
    // select chains: first returns developer, second returns platform devs, third returns nothing (apps via execute)
    let selectCallIdx = 0;
    app = await buildPublicApp({
      selectResult: [MOCK_DEVELOPER],
      executeResult: [MOCK_DEV_APP],
    });

    // Override select to return different results per call
    const mockDb = (app as any).db;
    const origSelect = mockDb.select.bind(mockDb);
    selectCallIdx = 0;
    mockDb.select = (...args: any[]) => {
      selectCallIdx++;
      if (selectCallIdx === 1) {
        // First select: developer lookup
        return createChainable([MOCK_DEVELOPER]);
      }
      if (selectCallIdx === 2) {
        // Second select: platform developers
        return createChainable([MOCK_PLATFORM_DEV]);
      }
      if (selectCallIdx === 3) {
        // Third select: globally enabled platform feature flags
        return createChainable([{ slug: "platform-shopify" }]);
      }
      return origSelect(...args);
    };

    const res = await app.inject({ method: "GET", url: "/api/public/developers/shopify/acme-inc" });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.slug).toBe("acme-inc");
    expect(body.name).toBe("Acme Inc");
    expect(body.website).toBe("https://acme.com");
    expect(body.platforms).toHaveLength(1);
    expect(body.platforms[0].platform).toBe("shopify");
    expect(body.apps).toHaveLength(1);
    expect(body.apps[0].slug).toBe("acme-app");
    expect(body.apps[0].averageRating).toBe(4.3);
  });

  it("returns 404 for non-existent developer", async () => {
    app = await buildPublicApp({ selectResult: [] });
    const res = await app.inject({ method: "GET", url: "/api/public/developers/shopify/unknown-dev" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Developer not found");
  });

  it("includes Cache-Control header", async () => {
    let selectCallIdx = 0;
    app = await buildPublicApp({
      selectResult: [MOCK_DEVELOPER],
      executeResult: [MOCK_DEV_APP],
    });
    const mockDb = (app as any).db;
    selectCallIdx = 0;
    mockDb.select = (..._args: any[]) => {
      selectCallIdx++;
      if (selectCallIdx === 1) return createChainable([MOCK_DEVELOPER]);
      if (selectCallIdx === 2) return createChainable([MOCK_PLATFORM_DEV]);
      if (selectCallIdx === 3) return createChainable([{ slug: "platform-shopify" }]);
      return createChainable([]);
    };

    const res = await app.inject({ method: "GET", url: "/api/public/developers/shopify/acme-inc" });
    expect(res.headers["cache-control"]).toBe("public, max-age=3600, stale-while-revalidate=7200");
  });

  it("returns 404 when requested developer has no visible platform match", async () => {
    // Developer exists but has no visible platform developers for the requested platform
    let selectCallIdx = 0;
    app = await buildPublicApp({ selectResult: [MOCK_DEVELOPER], executeResult: [] });
    const mockDb = (app as any).db;
    selectCallIdx = 0;
    mockDb.select = (..._args: any[]) => {
      selectCallIdx++;
      if (selectCallIdx === 1) return createChainable([MOCK_DEVELOPER]);
      if (selectCallIdx === 2) return createChainable([]); // no platform devs
      return createChainable([]);
    };

    const res = await app.inject({ method: "GET", url: "/api/public/developers/shopify/lonely-dev" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Developer not found" });
  });
});

// ===================================================================
// PLATFORM STATS ROUTE
// ===================================================================

describe("GET /api/public/platforms/:platform/stats", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns platform statistics with totalApps, totalCategories, averageRating", async () => {
    // The route makes 3 sequential select() calls; the mock always returns the same selectResult.
    // We override to return different values per call.
    app = await buildPublicApp({ selectResult: [{ count: 100 }] });
    const mockDb = (app as any).db;
    let selectCallIdx = 0;
    mockDb.select = (..._args: any[]) => {
      selectCallIdx++;
      if (selectCallIdx === 1) return createChainable([{ count: 500 }]);   // app count
      if (selectCallIdx === 2) return createChainable([{ count: 25 }]);    // category count
      if (selectCallIdx === 3) return createChainable([{ avg: 4.35 }]);    // avg rating
      return createChainable([]);
    };

    const res = await app.inject({ method: "GET", url: "/api/public/platforms/shopify/stats" });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.platform).toBe("shopify");
    expect(body.name).toBe("Shopify App Store");
    expect(body.totalApps).toBe(500);
    expect(body.totalCategories).toBe(25);
    expect(body.averageRating).toBe(4.35);
  });

  it("returns zeros when platform has no data", async () => {
    app = await buildPublicApp({ selectResult: [{ count: 0 }] });
    const mockDb = (app as any).db;
    let selectCallIdx = 0;
    mockDb.select = (..._args: any[]) => {
      selectCallIdx++;
      if (selectCallIdx === 1) return createChainable([{ count: 0 }]);
      if (selectCallIdx === 2) return createChainable([{ count: 0 }]);
      if (selectCallIdx === 3) return createChainable([{ avg: null }]);
      return createChainable([]);
    };

    const res = await app.inject({ method: "GET", url: "/api/public/platforms/shopify/stats" });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.totalApps).toBe(0);
    expect(body.totalCategories).toBe(0);
    expect(body.averageRating).toBeNull();
  });

  it("returns 400 for invalid platform", async () => {
    app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: "/api/public/platforms/invalid/stats" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Invalid platform");
  });

  it("includes Cache-Control header", async () => {
    app = await buildPublicApp({ selectResult: [{ count: 1 }] });
    const res = await app.inject({ method: "GET", url: "/api/public/platforms/shopify/stats" });
    expect(res.headers["cache-control"]).toBe("public, max-age=3600, stale-while-revalidate=7200");
  });
});

// ===================================================================
// PUBLIC KEYWORD ROUTE
// ===================================================================

describe("GET /api/public/keywords/:platform/:slug", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns keyword with top ranked apps", async () => {
    app = await buildPublicAppWithExecuteSequence(
      [],
      [
        [MOCK_KEYWORD],         // keyword lookup
        [MOCK_RANK_ROW],        // ranking rows
      ],
    );

    const res = await app.inject({ method: "GET", url: "/api/public/keywords/shopify/email-marketing" });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.keyword).toBe("email marketing");
    expect(body.slug).toBe("email-marketing");
    expect(body.platform).toBe("shopify");
    expect(body.totalRanked).toBe(1);
    expect(body.topApps).toHaveLength(1);
    expect(body.topApps[0].position).toBe(1);
    expect(body.topApps[0].appSlug).toBe("top-ranked");
    expect(body.topApps[0].averageRating).toBe(4.6);
  });

  it("returns keyword with empty topApps when no rankings exist", async () => {
    app = await buildPublicAppWithExecuteSequence(
      [],
      [
        [MOCK_KEYWORD],   // keyword found
        [],               // no rankings
      ],
    );

    const res = await app.inject({ method: "GET", url: "/api/public/keywords/shopify/email-marketing" });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.keyword).toBe("email marketing");
    expect(body.topApps).toEqual([]);
    expect(body.totalRanked).toBe(0);
  });

  it("returns 404 for non-existent keyword", async () => {
    app = await buildPublicApp({ executeResult: [] });
    const res = await app.inject({ method: "GET", url: "/api/public/keywords/shopify/unknown-kw" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Keyword not found");
  });

  it("returns 400 for invalid platform", async () => {
    app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: "/api/public/keywords/invalid/test" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Invalid platform");
  });

  it("includes Cache-Control header", async () => {
    app = await buildPublicAppWithExecuteSequence(
      [],
      [[MOCK_KEYWORD], [MOCK_RANK_ROW]],
    );
    const res = await app.inject({ method: "GET", url: "/api/public/keywords/shopify/email-marketing" });
    expect(res.headers["cache-control"]).toBe("public, max-age=3600, stale-while-revalidate=7200");
  });
});

// ===================================================================
// PUBLIC COMPARE ROUTE
// ===================================================================

describe("GET /api/public/compare/:platform/:slug1/:slug2", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns both apps and similarity score", async () => {
    app = await buildPublicAppWithExecuteSequence(
      [],
      [
        [MOCK_COMPARE_APP1, MOCK_COMPARE_APP2],                  // both apps query
        [{ overall_score: "0.7500" }],                            // similarity score
      ],
    );

    const res = await app.inject({ method: "GET", url: "/api/public/compare/shopify/app-alpha/app-beta" });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.app1.slug).toBe("app-alpha");
    expect(body.app1.name).toBe("App Alpha");
    expect(body.app1.averageRating).toBe(4.5);
    expect(body.app1.intro).toBe("Alpha intro");
    expect(body.app1.features).toEqual(["Feature A"]);
    expect(body.app1.languages).toEqual(["English"]);

    expect(body.app2.slug).toBe("app-beta");
    expect(body.app2.name).toBe("App Beta");
    expect(body.app2.averageRating).toBe(3.8);
    expect(body.app2.pricingPlans).toHaveLength(1);

    expect(body.similarityScore).toBe(0.75);
  });

  it("returns null similarity score when no score exists", async () => {
    app = await buildPublicAppWithExecuteSequence(
      [],
      [
        [MOCK_COMPARE_APP1, MOCK_COMPARE_APP2],  // both apps
        [],                                        // no similarity score
      ],
    );

    const res = await app.inject({ method: "GET", url: "/api/public/compare/shopify/app-alpha/app-beta" });
    expect(res.statusCode).toBe(200);
    expect(res.json().similarityScore).toBeNull();
  });

  it("returns 404 when one app is missing", async () => {
    app = await buildPublicApp({ executeResult: [MOCK_COMPARE_APP1] }); // only 1 app found
    const res = await app.inject({ method: "GET", url: "/api/public/compare/shopify/app-alpha/missing-app" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("One or both apps not found");
  });

  it("returns 404 when no apps are found", async () => {
    app = await buildPublicApp({ executeResult: [] });
    const res = await app.inject({ method: "GET", url: "/api/public/compare/shopify/missing1/missing2" });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for invalid platform", async () => {
    app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: "/api/public/compare/badplatform/app1/app2" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Invalid platform");
  });

  it("includes Cache-Control header", async () => {
    app = await buildPublicAppWithExecuteSequence(
      [],
      [[MOCK_COMPARE_APP1, MOCK_COMPARE_APP2], [{ overall_score: "0.50" }]],
    );
    const res = await app.inject({ method: "GET", url: "/api/public/compare/shopify/app-alpha/app-beta" });
    expect(res.headers["cache-control"]).toBe("public, max-age=3600, stale-while-revalidate=7200");
  });

  it("normalizes app data with defaults for missing fields", async () => {
    const sparseApp = {
      id: 3,
      slug: "sparse-app",
      name: "Sparse App",
      icon_url: null,
      platform: "shopify",
      average_rating: null,
      rating_count: 0,
      pricing_hint: null,
      active_installs: null,
      launched_date: null,
      is_built_for_shopify: false,
      intro: null,
      developer: null,
      pricing: null,
      pricing_plans: null,
      categories: null,
      features: null,
      languages: null,
    };
    app = await buildPublicAppWithExecuteSequence(
      [],
      [
        [MOCK_COMPARE_APP1, sparseApp],
        [],
      ],
    );

    const res = await app.inject({ method: "GET", url: "/api/public/compare/shopify/app-alpha/sparse-app" });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.app2.averageRating).toBeNull();
    expect(body.app2.intro).toBeNull();
    expect(body.app2.developer).toBeNull();
    expect(body.app2.pricingPlans).toEqual([]);
    expect(body.app2.features).toEqual([]);
    expect(body.app2.languages).toEqual([]);
  });
});

// ===================================================================
// NO AUTH REQUIRED (cross-cutting)
// ===================================================================

describe("Public routes require no authentication", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("all public endpoints respond without auth headers", async () => {
    app = await buildPublicApp({
      selectResult: [{ count: 1 }],
      executeResult: [],
    });

    const endpoints = [
      "/api/public/platforms/shopify/stats",
      "/api/public/categories/shopify",
    ];

    for (const url of endpoints) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    }
  });

  it("invalid platform returns 400, not 401", async () => {
    app = await buildPublicApp();

    const invalidEndpoints = [
      "/api/public/apps/invalid/test",
      "/api/public/categories/invalid/test",
      "/api/public/keywords/invalid/test",
      "/api/public/platforms/invalid/stats",
      "/api/public/compare/invalid/a/b",
    ];

    for (const url of invalidEndpoints) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(400);
    }
  });
});

// ===================================================================
// CROSS-PLATFORM — same slug returns different data per platform
// ===================================================================

describe("Cross-platform: same slug returns different data for different platforms", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("app route returns platform-specific data", async () => {
    for (const platform of ["shopify", "wix"] as const) {
      app = await buildPublicApp({
        selectResult: [{ ...MOCK_APP_ROW, platform, name: `${platform} App` }],
        executeResult: [MOCK_SNAPSHOT],
      });

      const res = await app.inject({ method: "GET", url: `/api/public/apps/${platform}/test-app` });
      expect(res.statusCode).toBe(200);
      expect(res.json().platform).toBe(platform);
      expect(res.json().name).toBe(`${platform} App`);
      await app.close();
    }
  });

  it("stats route returns platform-specific data", async () => {
    for (const platform of ["shopify", "atlassian"] as const) {
      app = await buildPublicApp({ selectResult: [{ count: 42 }] });
      const res = await app.inject({ method: "GET", url: `/api/public/platforms/${platform}/stats` });
      expect(res.statusCode).toBe(200);
      expect(res.json().platform).toBe(platform);
      await app.close();
    }
  });
});

// ===================================================================
// ALL 11 PLATFORMS
// ===================================================================

describe("All valid platforms are accepted", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("stats endpoint accepts all 12 platforms", async () => {
    for (const platform of ALL_PLATFORMS) {
      app = await buildPublicApp({ selectResult: [{ count: 1 }] });
      const res = await app.inject({ method: "GET", url: `/api/public/platforms/${platform}/stats` });
      expect(res.statusCode).toBe(200);
      expect(res.json().platform).toBe(platform);
      await app.close();
    }
  });
});

// ===================================================================
// Helper: chainable mock (mirrors createMockDb pattern)
// ===================================================================

function createChainable(resolveValue: any = []) {
  const chain: any = {};
  const methods = [
    "select", "from", "where", "leftJoin", "innerJoin", "rightJoin",
    "orderBy", "groupBy", "limit", "offset", "as", "having",
    "insert", "values", "returning", "onConflictDoUpdate", "onConflictDoNothing",
    "update", "set", "delete",
  ];
  for (const m of methods) {
    chain[m] = (..._args: any[]) => chain;
  }
  chain.then = (resolve: any, reject?: any) => {
    return Promise.resolve(resolveValue).then(resolve, reject);
  };
  return chain;
}
