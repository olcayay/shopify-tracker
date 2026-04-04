import { buildTestApp, adminToken, userToken, authHeaders, type MockDbOverrides } from "../helpers/test-app.js";
import { emailAnalyticsRoutes } from "../../routes/email-analytics.js";
import type { FastifyInstance } from "fastify";

async function buildApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  return buildTestApp({
    routes: emailAnalyticsRoutes,
    prefix: "/api/system-admin/email-analytics",
    db,
  });
}

describe("GET /api/system-admin/email-analytics/overview", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns overview stats for admin", async () => {
    app = await buildApp({
      executeResult: [{ sent: "100", delivered: "95", opened: "40", clicked: "10", bounced: "3", complained: "1", failed: "2", total: "100" }],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-analytics/overview",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sent).toBe(100);
    expect(body.delivered).toBe(95);
    expect(body.days).toBe(30);
    expect(body.openRate).toBeDefined();
    expect(body.bounceRate).toBeDefined();
  });

  it("accepts custom days param", async () => {
    app = await buildApp({
      executeResult: [{ sent: "0", delivered: "0", opened: "0", clicked: "0", bounced: "0", complained: "0", failed: "0", total: "0" }],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-analytics/overview?days=7",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().days).toBe(7);
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-analytics/overview",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without auth", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-analytics/overview",
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/system-admin/email-analytics/trends", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns trend data for admin", async () => {
    app = await buildApp({
      executeResult: {
        rows: [
          { date: "2026-04-01", sent: "10", opened: "5", clicked: "2", bounced: "0", failed: "0" },
          { date: "2026-04-02", sent: "15", opened: "8", clicked: "3", bounced: "1", failed: "0" },
        ],
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-analytics/trends",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.days).toBe(30);
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-analytics/trends",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/system-admin/email-analytics/by-type", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns by-type breakdown for admin", async () => {
    app = await buildApp({
      executeResult: {
        rows: [
          { email_type: "daily_digest", total: "50", sent: "48", opened: "20", clicked: "5", bounced: "1", failed: "1" },
        ],
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-analytics/by-type",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.days).toBe(30);
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-analytics/by-type",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/system-admin/email-analytics/engagement", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns engagement heatmap data for admin", async () => {
    app = await buildApp({
      executeResult: {
        rows: [
          { day_of_week: 1, hour: 9, opens: 15 },
          { day_of_week: 1, hour: 10, opens: 22 },
        ],
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-analytics/engagement",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toBeDefined();
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-analytics/engagement",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });
});
