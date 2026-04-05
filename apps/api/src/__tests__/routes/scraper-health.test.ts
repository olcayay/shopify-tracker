import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  adminToken,
  userToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";

describe("GET /api/system-admin/scraper/health", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { systemAdminRoutes } = await import("../../routes/system-admin.js");
    app = await buildTestApp({
      routes: systemAdminRoutes,
      prefix: "/api/system-admin",
      db: {
        executeResult: [
          {
            id: "run-001",
            platform: "shopify",
            scraper_type: "category",
            status: "completed",
            completed_at: new Date(Date.now() - 3600_000).toISOString(),
            started_at: new Date(Date.now() - 3900_000).toISOString(),
            metadata: { items_scraped: 42 },
            error: null,
            avg_duration_ms: 300000,
            prev_duration_ms: 280000,
            duration_ms: 300000,
          },
        ],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/scraper/health",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/scraper/health",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 200 with health data structure", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/scraper/health",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Verify top-level structure
    expect(body).toHaveProperty("matrix");
    expect(body).toHaveProperty("summary");
    expect(body).toHaveProperty("recentFailures");
    expect(body).toHaveProperty("anomalies");

    // Matrix has 12 platforms × 5 types = 60 cells
    expect(body.matrix).toHaveLength(60);

    // Summary has all required fields
    expect(body.summary).toHaveProperty("healthy");
    expect(body.summary).toHaveProperty("failed");
    expect(body.summary).toHaveProperty("stale");
    expect(body.summary).toHaveProperty("running");
    expect(body.summary).toHaveProperty("totalScheduled");
  });

  it("matrix cells have correct structure", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/scraper/health",
      headers: authHeaders(adminToken()),
    });
    const body = res.json();
    const cell = body.matrix[0];

    expect(cell).toHaveProperty("platform");
    expect(cell).toHaveProperty("scraperType");
    expect(cell).toHaveProperty("lastRun");
    expect(cell).toHaveProperty("avgDurationMs");
    expect(cell).toHaveProperty("prevDurationMs");
    expect(cell).toHaveProperty("currentlyRunning");
    expect(cell).toHaveProperty("runningStartedAt");
    expect(cell).toHaveProperty("schedule");
  });

  it("covers all 12 platforms in the matrix", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/scraper/health",
      headers: authHeaders(adminToken()),
    });
    const body = res.json();
    const platforms = [...new Set(body.matrix.map((c: any) => c.platform))];
    expect(platforms).toHaveLength(12);
    expect(platforms).toContain("shopify");
    expect(platforms).toContain("salesforce");
    expect(platforms).toContain("canva");
    expect(platforms).toContain("wix");
    expect(platforms).toContain("wordpress");
    expect(platforms).toContain("google_workspace");
    expect(platforms).toContain("atlassian");
    expect(platforms).toContain("zoom");
    expect(platforms).toContain("zoho");
    expect(platforms).toContain("zendesk");
    expect(platforms).toContain("hubspot");
  });

  it("covers all 5 scraper types in the matrix", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/scraper/health",
      headers: authHeaders(adminToken()),
    });
    const body = res.json();
    const types = [...new Set(body.matrix.map((c: any) => c.scraperType))];
    expect(types).toHaveLength(5);
    expect(types).toContain("category");
    expect(types).toContain("app_details");
    expect(types).toContain("keyword_search");
    expect(types).toContain("reviews");
    expect(types).toContain("compute_app_scores");
  });

  it("scheduled cells have cron and nextRunAt", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/scraper/health",
      headers: authHeaders(adminToken()),
    });
    const body = res.json();
    // Shopify category should have a schedule
    const shopifyCategory = body.matrix.find(
      (c: any) => c.platform === "shopify" && c.scraperType === "category"
    );
    expect(shopifyCategory.schedule).not.toBeNull();
    expect(shopifyCategory.schedule.cron).toBe("0 3 * * *");
    expect(shopifyCategory.schedule.nextRunAt).toBeTruthy();
  });

  it("summary totalScheduled counts correctly", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/scraper/health",
      headers: authHeaders(adminToken()),
    });
    const body = res.json();
    // All scheduled cells should be counted (some platforms don't have all types)
    const scheduledCells = body.matrix.filter((c: any) => c.schedule !== null);
    expect(body.summary.totalScheduled).toBe(scheduledCells.length);
  });

  it("unscheduled platform/type combos have null schedule", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/scraper/health",
      headers: authHeaders(adminToken()),
    });
    const body = res.json();
    // Canva has no reviews scraper
    const canvaReviews = body.matrix.find(
      (c: any) => c.platform === "canva" && c.scraperType === "reviews"
    );
    expect(canvaReviews.schedule).toBeNull();
  });
});
