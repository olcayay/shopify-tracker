import { buildTestApp, adminToken, userToken, authHeaders, type MockDbOverrides } from "../helpers/test-app.js";
import { emailSimulationRoutes } from "../../routes/email-simulation.js";
import type { FastifyInstance } from "fastify";

async function buildApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  return buildTestApp({
    routes: emailSimulationRoutes,
    prefix: "/api/system-admin/email-simulation",
    db,
  });
}

describe("POST /api/system-admin/email-simulation/simulate", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns simulation result for admin", async () => {
    // Each db.execute call returns a result — mock returns same for all
    app = await buildApp({ executeResult: [] });

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/email-simulation/simulate",
      headers: authHeaders(adminToken()),
      payload: {
        emailType: "email_daily_digest",
        userId: "user-001",
        accountId: "account-001",
        recipientEmail: "user@test.com",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.wouldSend).toBeDefined();
    expect(body.emailType).toBe("email_daily_digest");
    expect(body.recipient).toBe("user@test.com");
    expect(body.eligibilityChecks).toBeDefined();
    expect(Array.isArray(body.eligibilityChecks)).toBe(true);
    expect(body.summary).toBeDefined();
  });

  it("reports all checks passed when eligible", async () => {
    // All execute() calls return empty (no blockers)
    app = await buildApp({ executeResult: [] });

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/email-simulation/simulate",
      headers: authHeaders(adminToken()),
      payload: {
        emailType: "email_welcome",
        userId: "user-001",
        accountId: "account-001",
        recipientEmail: "new@test.com",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.wouldSend).toBe(true);
    expect(body.failedChecks).toHaveLength(0);
  });

  it("returns 400 when required fields are missing", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/email-simulation/simulate",
      headers: authHeaders(adminToken()),
      payload: { emailType: "email_daily_digest" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("required");
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/email-simulation/simulate",
      headers: authHeaders(userToken()),
      payload: {
        emailType: "email_daily_digest",
        userId: "user-001",
        accountId: "account-001",
        recipientEmail: "user@test.com",
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without auth", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/email-simulation/simulate",
      payload: {
        emailType: "email_daily_digest",
        userId: "user-001",
        accountId: "account-001",
        recipientEmail: "user@test.com",
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/system-admin/email-simulation/simulate-bulk", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns bulk estimation for admin", async () => {
    // Each db.execute() call destructures [result], so must be an array
    app = await buildApp({
      executeResult: [{ total: "100", count: "5" }],
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/email-simulation/simulate-bulk",
      headers: authHeaders(adminToken()),
      payload: { emailType: "email_daily_digest" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.emailType).toBe("email_daily_digest");
    expect(body.totalUsers).toBeDefined();
    expect(body.estimatedEligible).toBeDefined();
    expect(body.breakdown).toBeDefined();
  });

  it("returns 400 when emailType is missing", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/email-simulation/simulate-bulk",
      headers: authHeaders(adminToken()),
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("emailType is required");
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/email-simulation/simulate-bulk",
      headers: authHeaders(userToken()),
      payload: { emailType: "email_daily_digest" },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/system-admin/email-simulation/types", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns available email types for simulation", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-simulation/types",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]).toHaveProperty("type");
    expect(body.data[0]).toHaveProperty("label");
    expect(body.data[0]).toHaveProperty("category");
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-simulation/types",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });
});
