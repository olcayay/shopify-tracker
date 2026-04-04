import { buildTestApp, adminToken, userToken, authHeaders, type MockDbOverrides } from "../helpers/test-app.js";
import { emailLogRoutes } from "../../routes/email-logs.js";
import type { FastifyInstance } from "fastify";

async function buildApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  return buildTestApp({
    routes: emailLogRoutes,
    prefix: "/api/system-admin/email-logs",
    db,
  });
}

describe("GET /api/system-admin/email-logs", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns paginated email logs for admin", async () => {
    const mockLogs = [
      { id: "l1", emailType: "daily_digest", recipientEmail: "user@test.com", status: "sent", createdAt: new Date() },
    ];
    app = await buildApp({ selectResult: mockLogs });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-logs?limit=10&offset=0",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(0);
  });

  it("supports search filter", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-logs?search=test@example.com",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toBeDefined();
  });

  it("supports status filter", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-logs?status=failed",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-logs",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without auth", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-logs",
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/system-admin/email-logs/export", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns JSON export by default", async () => {
    const mockLogs = [
      { id: "l1", emailType: "welcome", recipientEmail: "u@test.com", recipientName: "User", subject: "Welcome", status: "sent", sentAt: null, openedAt: null, clickedAt: null, bouncedAt: null, errorMessage: null, messageId: "msg1", createdAt: new Date() },
    ];
    app = await buildApp({ selectResult: mockLogs });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-logs/export",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.count).toBeDefined();
  });

  it("returns CSV when format=csv", async () => {
    const mockLogs = [
      { id: "l1", emailType: "welcome", recipientEmail: "u@test.com", recipientName: "User", subject: "Welcome", status: "sent", sentAt: null, openedAt: null, clickedAt: null, bouncedAt: null, errorMessage: null, messageId: "msg1", createdAt: new Date() },
    ];
    app = await buildApp({ selectResult: mockLogs });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-logs/export?format=csv",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.payload).toContain("id,email_type");
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-logs/export",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/system-admin/email-logs/types", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns distinct email types for admin", async () => {
    app = await buildApp({
      executeResult: {
        rows: [
          { email_type: "daily_digest", count: 100 },
          { email_type: "welcome", count: 50 },
        ],
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-logs/types",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toBeDefined();
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-logs/types",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });
});
