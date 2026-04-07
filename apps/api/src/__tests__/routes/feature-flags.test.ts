import { buildTestApp, adminToken, userToken, authHeaders, type MockDbOverrides } from "../helpers/test-app.js";
import { featureFlagRoutes } from "../../routes/feature-flags.js";
import type { FastifyInstance } from "fastify";

const PREFIX = "/api/system-admin/feature-flags";

async function buildApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  return buildTestApp({
    routes: featureFlagRoutes,
    prefix: PREFIX,
    db,
  });
}

const mockFlag = {
  id: "flag-001",
  slug: "market-research",
  name: "Market Research",
  description: "Access to research tools",
  isEnabled: false,
  activatedAt: null,
  deactivatedAt: null,
  createdAt: new Date("2026-01-01"),
};

// ─── GET / ────────────────────────────────────────────────────────────────────

describe("GET /api/system-admin/feature-flags", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns all flags for admin", async () => {
    app = await buildApp({
      selectResult: [{ ...mockFlag, accountCount: 3 }],
    });

    const res = await app.inject({
      method: "GET",
      url: PREFIX,
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].slug).toBe("market-research");
  });

  it("returns empty array when no flags exist", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: PREFIX,
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(0);
  });

  it("returns 403 for non-admin", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: PREFIX,
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without auth", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: PREFIX,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ─── POST / ───────────────────────────────────────────────────────────────────

describe("POST /api/system-admin/feature-flags", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("creates a new flag", async () => {
    // selectResult = [] means slug uniqueness check passes (no existing flag)
    app = await buildApp({
      selectResult: [],
      insertResult: [{ ...mockFlag, slug: "new-feature" }],
    });

    const res = await app.inject({
      method: "POST",
      url: PREFIX,
      headers: authHeaders(adminToken()),
      payload: { slug: "new-feature", name: "New Feature" },
    });

    expect(res.statusCode).toBe(201);
  });

  it("rejects invalid slug format", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: PREFIX,
      headers: authHeaders(adminToken()),
      payload: { slug: "Invalid_Slug!", name: "Bad" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("lowercase");
  });

  it("rejects slug starting with number", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: PREFIX,
      headers: authHeaders(adminToken()),
      payload: { slug: "123-feature", name: "Bad" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("rejects missing slug or name", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: PREFIX,
      headers: authHeaders(adminToken()),
      payload: { slug: "test" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("required");
  });

  it("rejects duplicate slug", async () => {
    // selectResult has a match — slug already exists
    app = await buildApp({ selectResult: [{ id: "existing" }] });

    const res = await app.inject({
      method: "POST",
      url: PREFIX,
      headers: authHeaders(adminToken()),
      payload: { slug: "market-research", name: "Duplicate" },
    });

    expect(res.statusCode).toBe(409);
  });

  it("returns 403 for non-admin", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: PREFIX,
      headers: authHeaders(userToken()),
      payload: { slug: "test", name: "Test" },
    });

    expect(res.statusCode).toBe(403);
  });
});

// ─── GET /:slug ───────────────────────────────────────────────────────────────

describe("GET /api/system-admin/feature-flags/:slug", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns flag detail with accounts", async () => {
    // First select returns the flag, second returns the enabled accounts
    // With mock DB, both return the same result — we test the shape
    app = await buildApp({
      selectResult: [mockFlag],
    });

    const res = await app.inject({
      method: "GET",
      url: `${PREFIX}/market-research`,
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.slug).toBe("market-research");
    expect(body.accounts).toBeDefined();
    expect(body.accountCount).toBeDefined();
  });

  it("returns 404 for non-existent slug", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: `${PREFIX}/nonexistent`,
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(404);
  });
});

// ─── PATCH /:slug ─────────────────────────────────────────────────────────────

describe("PATCH /api/system-admin/feature-flags/:slug", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("toggles flag enabled state", async () => {
    app = await buildApp({ selectResult: [mockFlag] });

    const res = await app.inject({
      method: "PATCH",
      url: `${PREFIX}/market-research`,
      headers: authHeaders(adminToken()),
      payload: { isEnabled: true },
    });

    expect(res.statusCode).toBe(200);
  });

  it("updates flag name and description", async () => {
    app = await buildApp({ selectResult: [mockFlag] });

    const res = await app.inject({
      method: "PATCH",
      url: `${PREFIX}/market-research`,
      headers: authHeaders(adminToken()),
      payload: { name: "Updated Name", description: "Updated desc" },
    });

    expect(res.statusCode).toBe(200);
  });

  it("returns 404 for non-existent slug", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "PATCH",
      url: `${PREFIX}/nonexistent`,
      headers: authHeaders(adminToken()),
      payload: { isEnabled: true },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 400 when no fields provided", async () => {
    app = await buildApp({ selectResult: [mockFlag] });

    const res = await app.inject({
      method: "PATCH",
      url: `${PREFIX}/market-research`,
      headers: authHeaders(adminToken()),
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("No fields");
  });
});

// ─── POST /:slug/accounts ────────────────────────────────────────────────────

describe("POST /api/system-admin/feature-flags/:slug/accounts", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("enables flag for an account", async () => {
    // selectResult returns both flag lookup and account lookup
    app = await buildApp({
      selectResult: [{ id: "flag-001", name: "Test Account" }],
    });

    const res = await app.inject({
      method: "POST",
      url: `${PREFIX}/market-research/accounts`,
      headers: authHeaders(adminToken()),
      payload: { accountId: "account-001" },
    });

    expect(res.statusCode).toBe(201);
  });

  it("returns 400 when accountId missing", async () => {
    app = await buildApp({ selectResult: [mockFlag] });

    const res = await app.inject({
      method: "POST",
      url: `${PREFIX}/market-research/accounts`,
      headers: authHeaders(adminToken()),
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("accountId");
  });

  it("returns 404 for non-existent flag", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "POST",
      url: `${PREFIX}/nonexistent/accounts`,
      headers: authHeaders(adminToken()),
      payload: { accountId: "account-001" },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ─── DELETE /:slug/accounts/:accountId ────────────────────────────────────────

describe("DELETE /api/system-admin/feature-flags/:slug/accounts/:accountId", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns 404 for non-existent flag", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "DELETE",
      url: `${PREFIX}/nonexistent/accounts/account-001`,
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 403 for non-admin", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "DELETE",
      url: `${PREFIX}/market-research/accounts/account-001`,
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });
});

// ─── GET /:slug/accounts/search ──────────────────────────────────────────────

describe("GET /api/system-admin/feature-flags/:slug/accounts/search", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns search results for admin", async () => {
    app = await buildApp({
      selectResult: [{ id: "account-001", name: "Test Account" }],
    });

    const res = await app.inject({
      method: "GET",
      url: `${PREFIX}/market-research/accounts/search?q=test`,
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
  });

  it("returns 404 for non-existent flag", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: `${PREFIX}/nonexistent/accounts/search?q=test`,
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(404);
  });
});
