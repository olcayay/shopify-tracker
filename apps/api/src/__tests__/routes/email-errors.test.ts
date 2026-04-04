import { buildTestApp, adminToken, userToken, authHeaders, type MockDbOverrides } from "../helpers/test-app.js";
import { emailErrorRoutes } from "../../routes/email-errors.js";
import type { FastifyInstance } from "fastify";

async function buildApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  return buildTestApp({
    routes: emailErrorRoutes,
    prefix: "/api/system-admin/email-errors",
    db,
  });
}

describe("GET /api/system-admin/email-errors", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns recent errors for admin", async () => {
    app = await buildApp({
      executeResult: {
        rows: [
          { id: "e1", email_type: "daily_digest", recipient_email: "user@test.com", status: "failed", error_message: "ECONNREFUSED", created_at: new Date().toISOString() },
        ],
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-errors",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.count).toBeDefined();
  });

  it("accepts hours and limit query params", async () => {
    app = await buildApp({ executeResult: { rows: [] } });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-errors?hours=48&limit=10",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toBeDefined();
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-errors",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without auth", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-errors",
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/system-admin/email-errors/breakdown", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns error breakdown by category for admin", async () => {
    app = await buildApp({
      executeResult: {
        rows: [
          { category: "smtp_connection", count: 5 },
          { category: "template_render", count: 2 },
        ],
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-errors/breakdown",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.hours).toBe(24);
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-errors/breakdown",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/system-admin/email-errors/trend", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns hourly error trend for admin", async () => {
    app = await buildApp({
      executeResult: {
        rows: [
          { hour: "2026-04-03T09:00:00Z", count: 3, types_affected: 2 },
        ],
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-errors/trend",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.hours).toBe(24);
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-errors/trend",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/system-admin/email-errors/:id", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns error detail for admin", async () => {
    const mockError = { id: "e1", emailType: "daily_digest", status: "failed", errorMessage: "ECONNREFUSED" };
    app = await buildApp({ selectResult: [mockError] });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-errors/e1",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe("e1");
  });

  it("returns 404 for non-existent error", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-errors/nonexistent",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-errors/e1",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });
});
