import Fastify, { type FastifyInstance } from "fastify";
import { createMockDb, type MockDbOverrides } from "../helpers/test-app.js";
import { publicRoutes } from "../../routes/public.js";
import { vi } from "vitest";

// Prevent real Redis connections during tests
vi.mock("../../utils/cache.js", () => ({
  cacheGet: async (_key: string, fetcher: () => Promise<any>, _ttl: number) => fetcher(),
}));

/**
 * Build a minimal Fastify app for public routes (no auth).
 */
async function buildPublicTestApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const mockDb = createMockDb(db);
  app.decorate("db", mockDb);
  await app.register(
    async (instance) => {
      instance.db = mockDb;
      await publicRoutes(instance);
    },
    { prefix: "/api/public" }
  );
  await app.ready();
  return app;
}

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
  pricing: "Free plan available. Premium starts at $9.99/mo",
  pricing_plans: [{ name: "Free", price: "$0" }, { name: "Pro", price: "$9.99/mo" }],
  categories: [{ title: "Marketing", slug: "marketing" }],
  screenshots: ["https://example.com/ss1.png", "https://example.com/ss2.png"],
  features: ["Email marketing", "Analytics dashboard"],
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
    overall_score: "0.8500",
  },
];

describe("GET /api/public/apps/:platform/:slug", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) await app.close();
  });

  it("returns app data with all fields for a valid app", async () => {
    app = await buildPublicTestApp({
      selectResult: [MOCK_APP_ROW],
      executeResult: [MOCK_SNAPSHOT],
    });
    // Override execute to return snapshot first, then similar apps
    let callCount = 0;
    (app as any).db.execute = () => {
      callCount++;
      if (callCount === 1) return Promise.resolve([MOCK_SNAPSHOT]);
      return Promise.resolve(MOCK_SIMILAR_APPS);
    };

    const res = await app.inject({
      method: "GET",
      url: "/api/public/apps/shopify/test-app",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe("Test App");
    expect(body.slug).toBe("test-app");
    expect(body.platform).toBe("shopify");
    expect(body.intro).toBe("A great test app for developers.");
    expect(body.developer).toEqual({ name: "Test Dev", website: "https://testdev.com" });
    expect(body.pricingPlans).toEqual([{ name: "Free", price: "$0" }, { name: "Pro", price: "$9.99/mo" }]);
    expect(body.features).toEqual(["Email marketing", "Analytics dashboard"]);
    expect(body.screenshots).toHaveLength(2);
    expect(body.categories).toHaveLength(1);
    expect(body.averageRating).toBe(4.5);
    expect(body.ratingCount).toBe(100);
    expect(body.similarApps).toHaveLength(1);
    expect(body.similarApps[0].slug).toBe("similar-app");
    expect(body.similarApps[0].averageRating).toBe(4.2);
  });

  it("returns Cache-Control header", async () => {
    app = await buildPublicTestApp({
      selectResult: [MOCK_APP_ROW],
      executeResult: [MOCK_SNAPSHOT],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/public/apps/shopify/test-app",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toContain("public");
    expect(res.headers["cache-control"]).toContain("max-age=3600");
  });

  it("returns 404 for non-existent app", async () => {
    app = await buildPublicTestApp({
      selectResult: [],
      executeResult: [],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/public/apps/shopify/nonexistent",
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("App not found");
  });

  it("returns 400 for invalid platform", async () => {
    app = await buildPublicTestApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/public/apps/invalid-platform/test-app",
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Invalid platform");
  });

  it("handles missing snapshot data gracefully", async () => {
    app = await buildPublicTestApp({
      selectResult: [MOCK_APP_ROW],
      executeResult: [],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/public/apps/shopify/test-app",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe("Test App");
    expect(body.intro).toBeNull();
    expect(body.developer).toBeNull();
    expect(body.features).toEqual([]);
    expect(body.pricingPlans).toEqual([]);
    expect(body.categories).toEqual([]);
    expect(body.screenshots).toEqual([]);
    expect(body.similarApps).toEqual([]);
  });

  it("works for all 12 platforms", async () => {
    const platforms = [
      "shopify", "salesforce", "canva", "wix", "wordpress",
      "google_workspace", "atlassian", "zoom", "zoho", "zendesk", "hubspot",
    ];

    for (const platform of platforms) {
      app = await buildPublicTestApp({
        selectResult: [{ ...MOCK_APP_ROW, platform }],
        executeResult: [MOCK_SNAPSHOT],
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/public/apps/${platform}/test-app`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().platform).toBe(platform);
      await app.close();
    }
  });

  it("does not require authentication", async () => {
    app = await buildPublicTestApp({
      selectResult: [MOCK_APP_ROW],
      executeResult: [MOCK_SNAPSHOT],
    });

    // No auth headers — should still work
    const res = await app.inject({
      method: "GET",
      url: "/api/public/apps/shopify/test-app",
    });

    expect(res.statusCode).toBe(200);
  });
});
