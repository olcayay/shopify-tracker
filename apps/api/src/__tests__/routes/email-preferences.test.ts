import { buildTestApp, adminToken, userToken, authHeaders, type MockDbOverrides } from "../helpers/test-app.js";
import { emailPreferenceRoutes } from "../../routes/email-preferences.js";
import type { FastifyInstance } from "fastify";

async function buildApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  return buildTestApp({
    routes: emailPreferenceRoutes,
    prefix: "/api/email-preferences",
    db,
  });
}

describe("GET /api/email-preferences", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns categorized preferences for authenticated user", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/email-preferences",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.categories).toBeDefined();
    expect(Array.isArray(body.categories)).toBe(true);
    expect(body.categories.length).toBeGreaterThan(0);

    // Check structure
    const firstCat = body.categories[0];
    expect(firstCat.key).toBeDefined();
    expect(firstCat.label).toBeDefined();
    expect(firstCat.types).toBeDefined();
    expect(Array.isArray(firstCat.types)).toBe(true);
  });

  it("reflects saved preferences in response", async () => {
    app = await buildApp({
      selectResult: [
        { emailType: "email_daily_digest", enabled: false },
      ],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/email-preferences",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const digestsCat = body.categories.find((c: any) => c.key === "digests");
    expect(digestsCat).toBeDefined();
    const dailyDigest = digestsCat.types.find((t: any) => t.type === "email_daily_digest");
    expect(dailyDigest.enabled).toBe(false);
  });

  it("returns required types as always enabled", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/email-preferences",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const transactional = body.categories.find((c: any) => c.key === "transactional");
    const passwordReset = transactional.types.find((t: any) => t.type === "email_password_reset");
    expect(passwordReset.enabled).toBe(true);
    expect(passwordReset.required).toBe(true);
  });

  it("returns 401 without auth", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/email-preferences",
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("PATCH /api/email-preferences", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("updates preferences for authenticated user", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "PATCH",
      url: "/api/email-preferences",
      headers: authHeaders(userToken()),
      payload: {
        preferences: [
          { type: "email_daily_digest", enabled: false },
          { type: "email_weekly_summary", enabled: true },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe("Preferences updated");
    expect(res.json().updated).toBe(2);
  });

  it("returns 400 when preferences array is missing", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/email-preferences",
      headers: authHeaders(userToken()),
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("preferences array is required");
  });

  it("skips attempts to disable required email types", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "PATCH",
      url: "/api/email-preferences",
      headers: authHeaders(userToken()),
      payload: {
        preferences: [
          { type: "email_password_reset", enabled: false }, // required, should be skipped
          { type: "email_daily_digest", enabled: false },   // optional, should succeed
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    // Only the optional one should be counted as updated
    expect(res.json().updated).toBe(1);
  });

  it("returns 401 without auth", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/email-preferences",
      payload: { preferences: [] },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/email-preferences/categories", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns all email type categories", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/email-preferences/categories",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.categories).toBeDefined();
    expect(body.categories.transactional).toBeDefined();
    expect(body.categories.alerts).toBeDefined();
    expect(body.categories.digests).toBeDefined();
    expect(body.categories.lifecycle).toBeDefined();
    expect(body.categories.team).toBeDefined();
  });
});

// ─── Per-App Email Preferences ──────────────────────────────────────────────

describe("GET /api/email-preferences/apps", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns tracked apps with email preferences", async () => {
    app = await buildApp({
      selectResult: [
        { appId: 1, slug: "slack", name: "Slack", platform: "shopify", iconUrl: null, dailyDigestEnabled: null },
      ],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/email-preferences/apps",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.apps).toBeDefined();
    expect(Array.isArray(body.apps)).toBe(true);
    expect(body.apps[0].dailyDigestEnabled).toBe(true);
  });

  it("returns 401 without auth", async () => {
    app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/email-preferences/apps" });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/email-preferences/apps/:appId", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns default enabled for app without preference", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/email-preferences/apps/123",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().dailyDigestEnabled).toBe(true);
  });

  it("returns 400 for invalid appId", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/email-preferences/apps/abc",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /api/email-preferences/apps/:appId", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("updates per-app email preference", async () => {
    app = await buildApp({ insertResult: [] });

    const res = await app.inject({
      method: "PATCH",
      url: "/api/email-preferences/apps/123",
      headers: authHeaders(userToken()),
      payload: { dailyDigestEnabled: false },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().dailyDigestEnabled).toBe(false);
  });

  it("returns 400 when dailyDigestEnabled missing", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/email-preferences/apps/123",
      headers: authHeaders(userToken()),
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /api/email-preferences/apps/bulk", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("bulk updates per-app preferences", async () => {
    app = await buildApp({ insertResult: [] });

    const res = await app.inject({
      method: "PATCH",
      url: "/api/email-preferences/apps/bulk",
      headers: authHeaders(userToken()),
      payload: { appIds: [1, 2, 3], dailyDigestEnabled: true },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(3);
  });

  it("returns 400 when appIds missing", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/email-preferences/apps/bulk",
      headers: authHeaders(userToken()),
      payload: { dailyDigestEnabled: true },
    });

    expect(res.statusCode).toBe(400);
  });
});
