import Fastify, { type FastifyInstance } from "fastify";
import { createMockDb, type MockDbOverrides } from "../helpers/test-app.js";
import { publicRoutes } from "../../routes/public.js";
import { vi } from "vitest";

vi.mock("../../utils/cache.js", () => ({
  cacheGet: async (_key: string, fetcher: () => Promise<any>, _ttl: number) => fetcher(),
}));

async function buildPublicApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const mockDb = createMockDb(db);
  app.decorate("db", mockDb);
  await app.register(async (instance) => { instance.db = mockDb; await publicRoutes(instance); }, { prefix: "/api/public" });
  await app.ready();
  return app;
}

// --- Categories ---
describe("GET /api/public/categories/:platform/:slug", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns category data with top apps", async () => {
    app = await buildPublicApp({
      selectResult: [{ id: 1, slug: "marketing", title: "Marketing", description: "Marketing apps", isListingPage: true }],
      executeResult: [{ app_count: 50, scrape_run_id: "run-1", scraped_at: new Date() }],
    });
    const res = await app.inject({ method: "GET", url: "/api/public/categories/shopify/marketing" });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe("Marketing");
  });

  it("returns 404 for non-existent category", async () => {
    app = await buildPublicApp({ selectResult: [] });
    const res = await app.inject({ method: "GET", url: "/api/public/categories/shopify/nonexistent" });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for invalid platform", async () => {
    app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: "/api/public/categories/invalid/test" });
    expect(res.statusCode).toBe(400);
  });
});

// --- Category tree ---
describe("GET /api/public/categories/:platform", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns category list", async () => {
    app = await buildPublicApp({
      selectResult: [{ slug: "marketing", title: "Marketing", parentSlug: null, isListingPage: true }],
    });
    const res = await app.inject({ method: "GET", url: "/api/public/categories/shopify" });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
});

// --- Developers ---
describe("GET /api/public/developers/:platform/:slug", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns 404 for non-existent developer", async () => {
    app = await buildPublicApp({ selectResult: [] });
    const res = await app.inject({ method: "GET", url: "/api/public/developers/shopify/unknown-dev" });
    expect(res.statusCode).toBe(404);
  });
});

// --- Platform stats ---
describe("GET /api/public/platforms/:platform/stats", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns platform statistics", async () => {
    app = await buildPublicApp({
      selectResult: [{ count: 100 }],
    });
    const res = await app.inject({ method: "GET", url: "/api/public/platforms/shopify/stats" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.platform).toBe("shopify");
  });

  it("returns 400 for invalid platform", async () => {
    app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: "/api/public/platforms/invalid/stats" });
    expect(res.statusCode).toBe(400);
  });
});

// --- Keywords ---
describe("GET /api/public/keywords/:platform/:slug", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns 404 for non-existent keyword", async () => {
    app = await buildPublicApp({ executeResult: [] });
    const res = await app.inject({ method: "GET", url: "/api/public/keywords/shopify/unknown-kw" });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for invalid platform", async () => {
    app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: "/api/public/keywords/invalid/test" });
    expect(res.statusCode).toBe(400);
  });
});

// --- Comparison ---
describe("GET /api/public/compare/:platform/:slug1/:slug2", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns 404 when apps not found", async () => {
    app = await buildPublicApp({ executeResult: [] });
    const res = await app.inject({ method: "GET", url: "/api/public/compare/shopify/app1/app2" });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for invalid platform", async () => {
    app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: "/api/public/compare/invalid/app1/app2" });
    expect(res.statusCode).toBe(400);
  });
});

// --- All endpoints require no auth ---
describe("Public routes require no authentication", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("all public endpoints work without auth headers", async () => {
    app = await buildPublicApp({ selectResult: [{ count: 1 }] });

    const endpoints = [
      "/api/public/platforms/shopify/stats",
      "/api/public/categories/shopify",
    ];

    for (const url of endpoints) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).not.toBe(401);
    }
  });
});
