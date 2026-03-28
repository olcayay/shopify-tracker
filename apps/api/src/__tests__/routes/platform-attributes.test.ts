import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, userToken, authHeaders } from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildPlatformAttributesApp(dbOverrides = {}) {
  const { platformAttributeRoutes } = await import("../../routes/platform-attributes.js");
  return buildTestApp({
    routes: platformAttributeRoutes,
    prefix: "/api/platform-attributes",
    db: dbOverrides,
  });
}

describe("Platform-attributes routes", () => {
  describe("GET /api/platform-attributes/:type/:value", () => {
    it("returns 401 without auth", async () => {
      const app = await buildPlatformAttributesApp();
      try {
        const res = await app.inject({
          method: "GET",
          url: "/api/platform-attributes/industry/retail",
        });
        expect(res.statusCode).toBe(401);
      } finally {
        await app.close();
      }
    });

    it("returns 400 for unknown attribute type", async () => {
      const app = await buildPlatformAttributesApp();
      try {
        const res = await app.inject({
          method: "GET",
          url: "/api/platform-attributes/unknown-type/some-value",
          headers: authHeaders(userToken()),
        });
        expect(res.statusCode).toBe(400);
        const body = res.json();
        expect(body.error).toContain("Unknown attribute type");
      } finally {
        await app.close();
      }
    });

    it("returns 200 with valid type/value and correct structure", async () => {
      const executeResult = {
        rows: [
          { slug: "app-one", name: "App One", icon_url: null, badges: null, average_rating: 4.5, rating_count: 10, pricing: "Free" },
        ],
      };
      const app = await buildPlatformAttributesApp({ executeResult });
      try {
        const res = await app.inject({
          method: "GET",
          url: "/api/platform-attributes/industry/retail",
          headers: authHeaders(userToken()),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body).toHaveProperty("type", "industry");
        expect(body).toHaveProperty("value", "retail");
        expect(body).toHaveProperty("platform");
        expect(body).toHaveProperty("apps");
        expect(Array.isArray(body.apps)).toBe(true);
      } finally {
        await app.close();
      }
    });

    it('defaults platform to "salesforce"', async () => {
      const executeResult = { rows: [] };
      const app = await buildPlatformAttributesApp({ executeResult });
      try {
        const res = await app.inject({
          method: "GET",
          url: "/api/platform-attributes/industry/retail",
          headers: authHeaders(userToken()),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.platform).toBe("salesforce");
      } finally {
        await app.close();
      }
    });

    it("response includes type, value, platform, apps fields", async () => {
      const executeResult = {
        rows: [
          { slug: "crm-app", name: "CRM App", icon_url: "https://example.com/icon.png", badges: ["top"], average_rating: 4.8, rating_count: 100, pricing: "Paid" },
          { slug: "erp-app", name: "ERP App", icon_url: null, badges: null, average_rating: 3.5, rating_count: 25, pricing: "Free" },
        ],
      };
      const app = await buildPlatformAttributesApp({ executeResult });
      try {
        const res = await app.inject({
          method: "GET",
          url: "/api/platform-attributes/business-need/analytics?platform=salesforce",
          headers: authHeaders(userToken()),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.type).toBe("business-need");
        expect(body.value).toBe("analytics");
        expect(body.platform).toBe("salesforce");
        expect(body.apps).toHaveLength(2);
        expect(body.apps[0]).toHaveProperty("slug", "crm-app");
        expect(body.apps[1]).toHaveProperty("slug", "erp-app");
      } finally {
        await app.close();
      }
    });
  });
});
