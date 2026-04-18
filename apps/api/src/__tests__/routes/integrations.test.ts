import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, userToken, authHeaders } from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildIntegrationsApp(dbOverrides = {}) {
  const { integrationRoutes } = await import("../../routes/integrations.js");
  return buildTestApp({
    routes: integrationRoutes,
    prefix: "/api/integrations",
    db: dbOverrides,
  });
}

describe("Integration routes", () => {
  describe("GET /api/integrations/:name", () => {
    it("returns 401 without auth", async () => {
      const app = await buildIntegrationsApp();
      try {
        const res = await app.inject({
          method: "GET",
          url: "/api/integrations/slack",
        });
        expect(res.statusCode).toBe(401);
      } finally {
        await app.close();
      }
    });

    it("returns 200 when db.execute returns rows with apps", async () => {
      const executeResult = {
        rows: [
          { slug: "app-one", name: "App One", average_rating: 4.5, rating_count: 10, pricing: "Free" },
          { slug: "app-two", name: "App Two", average_rating: 3.0, rating_count: 5, pricing: "Paid" },
        ],
      };
      const app = await buildIntegrationsApp({ executeResult });
      try {
        const res = await app.inject({
          method: "GET",
          url: "/api/integrations/slack",
          headers: authHeaders(userToken()),
        });
        expect(res.statusCode).toBe(200);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when db.execute returns empty array", async () => {
      const executeResult = { rows: [] };
      const app = await buildIntegrationsApp({ executeResult });
      try {
        const res = await app.inject({
          method: "GET",
          url: "/api/integrations/nonexistent",
          headers: authHeaders(userToken()),
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });

    it("response includes name and apps fields", async () => {
      const executeResult = {
        rows: [
          { slug: "app-one", name: "App One", average_rating: 4.5, rating_count: 10, pricing: "Free" },
        ],
      };
      const app = await buildIntegrationsApp({ executeResult });
      try {
        const res = await app.inject({
          method: "GET",
          url: "/api/integrations/slack",
          headers: authHeaders(userToken()),
        });
        const body = res.json();
        expect(body).toHaveProperty("name", "slack");
        expect(body).toHaveProperty("apps");
        expect(Array.isArray(body.apps)).toBe(true);
        expect(body.apps).toHaveLength(1);
      } finally {
        await app.close();
      }
    });

    it("resolves display name from matched_integration and strips it from apps", async () => {
      const executeResult = {
        rows: [
          {
            slug: "app-one",
            name: "App One",
            average_rating: 4.5,
            rating_count: 10,
            pricing: "Free",
            matched_integration: "Service Cloud",
          },
        ],
      };
      const app = await buildIntegrationsApp({ executeResult });
      try {
        const res = await app.inject({
          method: "GET",
          url: "/api/integrations/service-cloud",
          headers: authHeaders(userToken()),
        });
        const body = res.json();
        // Should use the resolved display name, not the slug
        expect(body.name).toBe("Service Cloud");
        // matched_integration should be stripped from app objects
        expect(body.apps[0]).not.toHaveProperty("matched_integration");
        expect(body.apps[0]).toHaveProperty("slug", "app-one");
      } finally {
        await app.close();
      }
    });

    it("works with platform query param", async () => {
      const executeResult = {
        rows: [
          { slug: "sf-app", name: "SF App", average_rating: 4.0, rating_count: 20, pricing: "Free" },
        ],
      };
      const app = await buildIntegrationsApp({ executeResult });
      try {
        const res = await app.inject({
          method: "GET",
          url: "/api/integrations/slack?platform=salesforce",
          headers: authHeaders(userToken()),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.name).toBe("slack");
        expect(body.apps).toHaveLength(1);
      } finally {
        await app.close();
      }
    });
  });
});
