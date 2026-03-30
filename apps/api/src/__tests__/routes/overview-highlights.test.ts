import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  buildTestApp,
  userToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";
import { overviewHighlightsRoutes } from "../../routes/overview-highlights.js";

describe("Overview highlights routes", () => {
  let app: FastifyInstance;

  // Track execute calls to return different results per query
  let executeCallIndex: number;
  const executeResults: any[][] = [];

  function setExecuteResults(...results: any[][]) {
    executeCallIndex = 0;
    executeResults.length = 0;
    executeResults.push(...results);
  }

  beforeAll(async () => {
    app = await buildTestApp({
      routes: overviewHighlightsRoutes,
      prefix: "/api/overview",
      db: {
        executeResult: [], // default empty
      },
    });

    // Override the db.execute to return sequential results
    const originalExecute = app.db.execute;
    app.db.execute = vi.fn((...args: any[]) => {
      const idx = executeCallIndex++;
      return Promise.resolve(executeResults[idx] ?? []);
    }) as any;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/overview/highlights", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/overview/highlights",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns empty platforms when no tracked apps", async () => {
      setExecuteResults(
        [] // tracked apps query returns empty
      );
      const res = await app.inject({
        method: "GET",
        url: "/api/overview/highlights",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.platforms).toEqual({});
    });

    it("returns per-platform highlight data for tracked apps", async () => {
      setExecuteResults(
        // 1. Tracked apps
        [
          { id: 1, platform: "shopify", slug: "my-app", name: "My App", icon_url: "https://example.com/icon.png", average_rating: "4.5", rating_count: 100, keyword_count: "5" },
          { id: 2, platform: "salesforce", slug: "sf-app", name: "SF App", icon_url: null, average_rating: null, rating_count: 0, keyword_count: "0" },
        ],
        // 2. Keyword movers
        [
          { app_id: 1, keyword: "forms", old_position: 10, new_position: 5, delta: 5 },
        ],
        // 3. Category movers
        [
          { app_id: 1, category: "productivity", old_position: 8, new_position: 3, delta: 5 },
        ],
        // 4. Review pulse
        [
          { app_id: 1, v7d: 12, v30d: 45, momentum: "accelerating", average_rating: "4.5" },
        ],
        // 5. Recent changes
        [
          { app_id: 1, field: "description", old_value: "Old desc", new_value: "New desc", detected_at: "2026-03-30T10:00:00Z" },
        ],
        // 6. Featured sightings
        [
          { app_id: 1, section_title: "Staff Picks", position: 2, seen_date: "2026-03-30" },
        ],
        // 7. Competitor app IDs
        [
          { competitor_app_id: 10 },
        ],
        // 8. Competitor alerts
        [
          { competitor_id: 10, field: "pricing", old_value: "Free", new_value: "$10/mo", detected_at: "2026-03-30T09:00:00Z", competitor_name: "Rival", competitor_slug: "rival", competitor_platform: "shopify" },
        ],
        // 9. Ad activity
        [
          { app_id: 1, keyword: "form builder", seen_date: "2026-03-30" },
        ],
      );

      const res = await app.inject({
        method: "GET",
        url: "/api/overview/highlights",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();

      // Should have 2 platforms
      expect(Object.keys(body.platforms)).toEqual(expect.arrayContaining(["shopify", "salesforce"]));

      // Shopify platform
      const shopify = body.platforms.shopify;
      expect(shopify.apps).toHaveLength(1);
      expect(shopify.apps[0].name).toBe("My App");
      expect(shopify.apps[0].rating).toBe(4.5);

      // Highlights
      expect(shopify.highlights.keywordMovers).toHaveLength(1);
      expect(shopify.highlights.keywordMovers[0].keyword).toBe("forms");
      expect(shopify.highlights.keywordMovers[0].delta).toBe(5);

      expect(shopify.highlights.categoryMovers).toHaveLength(1);
      expect(shopify.highlights.categoryMovers[0].category).toBe("productivity");

      expect(shopify.highlights.reviewPulse).toHaveLength(1);
      expect(shopify.highlights.reviewPulse[0].v7d).toBe(12);

      expect(shopify.highlights.recentChanges).toHaveLength(1);
      expect(shopify.highlights.recentChanges[0].field).toBe("description");

      expect(shopify.highlights.featuredSightings).toHaveLength(1);
      expect(shopify.highlights.featuredSightings[0].sectionTitle).toBe("Staff Picks");

      expect(shopify.highlights.competitorAlerts).toHaveLength(1);
      expect(shopify.highlights.competitorAlerts[0].competitor.name).toBe("Rival");

      expect(shopify.highlights.adActivity).toHaveLength(1);
      expect(shopify.highlights.adActivity[0].keyword).toBe("form builder");

      // Salesforce — no highlights expected (all data is for app_id=1 which is shopify)
      const sf = body.platforms.salesforce;
      expect(sf.apps).toHaveLength(1);
      expect(sf.apps[0].name).toBe("SF App");
      expect(sf.highlights.keywordMovers).toHaveLength(0);
    });

    it("accepts optional platform filter", async () => {
      setExecuteResults(
        // Tracked apps (only shopify returned because of filter)
        [
          { id: 1, platform: "shopify", slug: "my-app", name: "My App", icon_url: null, average_rating: null, rating_count: 0, keyword_count: "0" },
        ],
        [], [], [], [], [], [], [], [],
      );

      const res = await app.inject({
        method: "GET",
        url: "/api/overview/highlights?platform=shopify",
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Object.keys(body.platforms)).toEqual(["shopify"]);
    });
  });
});
