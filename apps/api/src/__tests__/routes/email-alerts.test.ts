import { buildTestApp, adminToken, userToken, authHeaders, type MockDbOverrides } from "../helpers/test-app.js";
import { emailAlertRoutes } from "../../routes/email-alerts.js";
import type { FastifyInstance } from "fastify";

async function buildApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  return buildTestApp({
    routes: emailAlertRoutes,
    prefix: "/api/system-admin/email-alerts",
    db,
  });
}

describe("GET /api/system-admin/email-alerts/rules", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns alert rules for admin", async () => {
    const mockRules = [
      { id: "r1", ruleName: "High bounce rate", metric: "bounce_rate", threshold: 5, enabled: true },
      { id: "r2", ruleName: "Failed sends spike", metric: "failed_count", threshold: 10, enabled: false },
    ];
    app = await buildApp({ selectResult: mockRules });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-alerts/rules",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].ruleName).toBe("High bounce rate");
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-alerts/rules",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without auth", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-alerts/rules",
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("PUT /api/system-admin/email-alerts/rules/:id", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("updates an existing rule", async () => {
    const mockRule = { id: "r1", ruleName: "High bounce rate", threshold: 5, enabled: true };
    app = await buildApp({ selectResult: [mockRule] });

    const res = await app.inject({
      method: "PUT",
      url: "/api/system-admin/email-alerts/rules/r1",
      headers: authHeaders(adminToken()),
      payload: { threshold: 10, enabled: false },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe("Rule updated");
    expect(res.json().id).toBe("r1");
  });

  it("returns 404 for non-existent rule", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "PUT",
      url: "/api/system-admin/email-alerts/rules/nonexistent",
      headers: authHeaders(adminToken()),
      payload: { threshold: 10 },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "PUT",
      url: "/api/system-admin/email-alerts/rules/r1",
      headers: authHeaders(userToken()),
      payload: { enabled: false },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/system-admin/email-alerts/history", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns alert history for admin", async () => {
    const mockLogs = [
      { id: "l1", ruleId: "r1", ruleName: "Bounce rate", message: "Threshold breached", createdAt: new Date() },
    ];
    app = await buildApp({ selectResult: mockLogs });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-alerts/history",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.count).toBeDefined();
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-alerts/history",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("POST /api/system-admin/email-alerts/test", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("creates a test alert for admin", async () => {
    const mockRule = { id: "r1", ruleName: "Bounce rate alert", metric: "bounce_rate", threshold: 5, channels: ["email"] };
    app = await buildApp({ selectResult: [mockRule] });

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/email-alerts/test",
      headers: authHeaders(adminToken()),
      payload: { ruleId: "r1" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe("Test alert created");
    expect(res.json().ruleName).toBe("Bounce rate alert");
  });

  it("returns 404 when no rule found", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/email-alerts/test",
      headers: authHeaders(adminToken()),
      payload: {},
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/email-alerts/test",
      headers: authHeaders(userToken()),
      payload: {},
    });

    expect(res.statusCode).toBe(403);
  });
});
