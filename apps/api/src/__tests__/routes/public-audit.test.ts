import Fastify, { type FastifyInstance } from "fastify";
import { createMockDb } from "../helpers/test-app.js";
import { publicRoutes } from "../../routes/public.js";
import { vi, describe, it, expect, afterEach } from "vitest";

vi.mock("../../utils/cache.js", () => ({
  cacheGet: async (_key: string, fetcher: () => Promise<any>, _ttl: number) => fetcher(),
}));

const MOCK_AUDIT_ROW = {
  slug: "test-app",
  name: "Test App — Email Marketing",
  icon_url: "https://example.com/icon.png",
  platform: "shopify",
  average_rating: "4.50",
  rating_count: 100,
  pricing_hint: "Free plan available",
  is_built_for_shopify: true,
  badges: ["built_for_shopify"],
  app_card_subtitle: "Grow your email list",
  app_introduction: "A powerful email marketing platform for growing your online business.",
  app_details: "This app provides drag-and-drop email builder, automated workflows, customer segmentation, A/B testing, and real-time analytics. Works with all Shopify themes and integrates with popular tools.",
  seo_title: "Best Email Marketing App",
  seo_meta_description: "Grow your store with email marketing",
  features: ["Drag & drop editor", "Automation", "Segmentation", "A/B testing", "Analytics"],
  screenshots: ["s1.png", "s2.png", "s3.png", "s4.png", "s5.png"],
  languages: ["English", "Spanish", "French", "German", "Portuguese"],
  integrations: ["Klaviyo", "Mailchimp"],
  categories: [{ name: "Marketing" }, { name: "Email" }],
  pricing: "Free plan available",
  pricing_plans: [{ name: "Free", price: "$0", description: "Basic features" }],
  developer: { name: "Test Dev" },
  support: { privacy: "https://privacy.com", docs: "https://docs.com" },
  demo_store_url: "https://demo.example.com",
  platform_data: { features: ["email", "sms", "push", "automation", "segmentation"] },
};

async function buildApp(executeResult: any = null): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const mockDb = createMockDb({});
  mockDb.execute = () => Promise.resolve(executeResult ? [executeResult] : []);
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

describe("GET /public/audit/:platform/:slug", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) await app.close();
  });

  it("returns audit report for valid app", async () => {
    app = await buildApp(MOCK_AUDIT_ROW);
    const res = await app.inject({ method: "GET", url: "/api/public/audit/shopify/test-app" });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("overallScore");
    expect(body.overallScore).toBeGreaterThan(0);
    expect(body.overallScore).toBeLessThanOrEqual(100);
    expect(body.sections).toHaveLength(6);
    expect(body.recommendations).toBeInstanceOf(Array);
    expect(body.app.name).toBe("Test App — Email Marketing");
    expect(body.app.slug).toBe("test-app");
    expect(body.app.platform).toBe("shopify");
    expect(body.generatedAt).toBeTruthy();
  });

  it("returns 404 for unknown app", async () => {
    app = await buildApp(null);
    const res = await app.inject({ method: "GET", url: "/api/public/audit/shopify/nonexistent" });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("App not found");
  });

  it("returns 400 for invalid platform", async () => {
    app = await buildApp(null);
    const res = await app.inject({ method: "GET", url: "/api/public/audit/invalid/test-app" });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Invalid platform");
  });

  it("report has all 6 section types", async () => {
    app = await buildApp(MOCK_AUDIT_ROW);
    const res = await app.inject({ method: "GET", url: "/api/public/audit/shopify/test-app" });
    const body = res.json();

    const sectionIds = body.sections.map((s: any) => s.id);
    expect(sectionIds).toContain("title");
    expect(sectionIds).toContain("content");
    expect(sectionIds).toContain("visuals");
    expect(sectionIds).toContain("categories");
    expect(sectionIds).toContain("technical");
    expect(sectionIds).toContain("languages");
  });

  it("sets cache-control header", async () => {
    app = await buildApp(MOCK_AUDIT_ROW);
    const res = await app.inject({ method: "GET", url: "/api/public/audit/shopify/test-app" });

    expect(res.headers["cache-control"]).toContain("max-age=3600");
  });
});
