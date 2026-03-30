import { buildTestApp, adminToken, userToken, authHeaders, type MockDbOverrides } from "../helpers/test-app.js";
import { adminEmailRoutes } from "../../routes/admin-emails.js";
import type { FastifyInstance } from "fastify";

async function buildApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  return buildTestApp({
    routes: adminEmailRoutes,
    prefix: "/api/system-admin",
    db,
  });
}

describe("GET /api/system-admin/emails", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns paginated email list for admin", async () => {
    const mockEmails = [
      { id: "e1", emailType: "daily_digest", recipientEmail: "user@test.com", status: "sent", createdAt: new Date() },
    ];
    app = await buildApp({
      selectResult: mockEmails,
      executeResult: [{ count: 1 }],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/emails?limit=10&offset=0",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.emails).toBeDefined();
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(0);
  });

  it("requires admin auth", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/emails",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });

  it("rejects unauthenticated requests", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/emails",
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/system-admin/emails/stats", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns email stats for admin", async () => {
    app = await buildApp({
      executeResult: [{ total: "100", sent: "80", failed: "5", opened: "40", clicked: "20", sent_24h: "10", sent_7d: "50" }],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/emails/stats",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(100);
    expect(body.sent).toBe(80);
    expect(body.openRate).toBe(50); // 40/80 = 50%
    expect(body.clickRate).toBe(25); // 20/80 = 25%
  });
});

describe("GET /api/system-admin/emails/:id", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns email detail for admin", async () => {
    app = await buildApp({
      selectResult: [{ id: "e1", emailType: "daily_digest", subject: "Test", htmlBody: "<p>Hi</p>" }],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/emails/e1",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().subject).toBe("Test");
  });

  it("returns 404 for non-existent email", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/emails/nonexistent",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/system-admin/email-configs", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns email configs for admin", async () => {
    app = await buildApp({
      selectResult: [
        { emailType: "daily_digest", enabled: true, frequencyLimitHours: 24 },
      ],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/email-configs",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()[0].emailType).toBe("daily_digest");
  });
});

describe("PATCH /api/system-admin/email-configs/:type", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns 404 when email type not found", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "PATCH",
      url: "/api/system-admin/email-configs/nonexistent",
      headers: authHeaders(adminToken()),
      payload: { enabled: false },
    });

    // update().returning() resolves to [] in mock = 404
    expect(res.statusCode).toBe(404);
  });

  it("requires admin auth", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/system-admin/email-configs/daily_digest",
      headers: authHeaders(userToken()),
      payload: { enabled: false },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("POST /api/system-admin/email-configs/:type/toggle", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("toggles email config for admin", async () => {
    app = await buildApp({
      selectResult: [{ enabled: true }],
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/email-configs/daily_digest/toggle",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
  });
});

// --- Variable Registry & Preview ---

describe("GET /api/system-admin/emails/variables/:emailType", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns variables for a valid email type", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/emails/variables/email_ranking_alert",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.emailType).toBe("email_ranking_alert");
    expect(Array.isArray(body.variables)).toBe(true);
    expect(body.variables.length).toBeGreaterThan(0);
    expect(body.variables[0]).toHaveProperty("name");
    expect(body.variables[0]).toHaveProperty("description");
    expect(body.variables[0]).toHaveProperty("example");
  });

  it("returns 404 for unknown email type", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/emails/variables/unknown_type",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/system-admin/emails/preview", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("renders email preview with default sample data", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/emails/preview",
      headers: authHeaders(adminToken()),
      payload: { emailType: "email_ranking_alert" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.subject).toBeDefined();
    expect(body.html).toBeDefined();
    expect(body.variables).toBeDefined();
    expect(body.resolvedVariables).toBeDefined();
  });

  it("renders email preview with custom variables", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/emails/preview",
      headers: authHeaders(adminToken()),
      payload: {
        emailType: "email_ranking_alert",
        variables: { appName: "TestApp", position: 1 },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.resolvedVariables.appName).toBe("TestApp");
    expect(body.resolvedVariables.position).toBe(1);
  });

  it("renders custom subject with variable interpolation", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/emails/preview",
      headers: authHeaders(adminToken()),
      payload: {
        emailType: "email_ranking_alert",
        variables: { appName: "MyApp" },
        customSubject: "{{appName}} moved to position {{position}}!",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.subject).toContain("MyApp");
    expect(body.subject).toContain("position");
  });

  it("returns 400 for unknown email type", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/emails/preview",
      headers: authHeaders(adminToken()),
      payload: { emailType: "nonexistent" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/system-admin/notifications/variables/:notificationType", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns variables for a valid notification type", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notifications/variables/ranking_top3_entry",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.notificationType).toBe("ranking_top3_entry");
    expect(Array.isArray(body.variables)).toBe(true);
    expect(body.variables.length).toBeGreaterThan(0);
  });

  it("returns 404 for unknown notification type", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/notifications/variables/unknown_type",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/system-admin/notifications/preview", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("renders notification preview with default sample data", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/notifications/preview",
      headers: authHeaders(adminToken()),
      payload: { notificationType: "ranking_top3_entry" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.title).toBeDefined();
    expect(body.body).toBeDefined();
    expect(body.priority).toBeDefined();
    expect(body.variables).toBeDefined();
  });

  it("renders notification preview with custom title and body", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/notifications/preview",
      headers: authHeaders(adminToken()),
      payload: {
        notificationType: "ranking_top3_entry",
        variables: { appName: "TestApp", position: 1 },
        customTitle: "{{appName}} is #{{position}}!",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.title).toBe("TestApp is #1!");
  });

  it("returns 400 for unknown notification type", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/notifications/preview",
      headers: authHeaders(adminToken()),
      payload: { notificationType: "nonexistent" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/system-admin/emails/send", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns 400 when missing required fields", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/emails/send",
      headers: authHeaders(adminToken()),
      payload: { emailType: "daily_digest" },
    });

    expect(res.statusCode).toBe(400);
  });
});
