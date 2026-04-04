import { buildTestApp, adminToken, userToken, authHeaders, type MockDbOverrides } from "../helpers/test-app.js";
import { suppressionRoutes } from "../../routes/suppression.js";
import type { FastifyInstance } from "fastify";

async function buildApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  return buildTestApp({
    routes: suppressionRoutes,
    prefix: "/api/system-admin/suppression",
    db,
  });
}

describe("GET /api/system-admin/suppression", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns suppressed addresses for admin", async () => {
    const mockRows = [
      { id: "s1", email: "bounced@test.com", reason: "hard_bounce", bounceCount: 3, lastBounceAt: new Date(), removedAt: null },
    ];
    app = await buildApp({ selectResult: mockRows });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/suppression",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.count).toBeDefined();
    expect(body.total).toBeDefined();
  });

  it("supports reason filter", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/suppression?reason=hard_bounce",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
  });

  it("supports pagination", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/suppression?limit=10&offset=20",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/suppression",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without auth", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/suppression",
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("DELETE /api/system-admin/suppression/:id", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("removes suppression for admin", async () => {
    const mockEntry = { id: "s1", email: "bounced@test.com", reason: "hard_bounce", removedAt: null };
    app = await buildApp({ selectResult: [mockEntry] });

    const res = await app.inject({
      method: "DELETE",
      url: "/api/system-admin/suppression/s1",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe("Suppression removed");
    expect(res.json().email).toBe("bounced@test.com");
  });

  it("returns 404 for non-existent entry", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "DELETE",
      url: "/api/system-admin/suppression/nonexistent",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 409 when already removed", async () => {
    const mockEntry = { id: "s1", email: "bounced@test.com", reason: "hard_bounce", removedAt: new Date() };
    app = await buildApp({ selectResult: [mockEntry] });

    const res = await app.inject({
      method: "DELETE",
      url: "/api/system-admin/suppression/s1",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("Already removed");
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "DELETE",
      url: "/api/system-admin/suppression/s1",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("POST /api/system-admin/suppression/import", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("imports emails for admin", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/suppression/import",
      headers: authHeaders(adminToken()),
      payload: {
        emails: ["bounce1@test.com", "bounce2@test.com"],
        reason: "manual",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.imported).toBeDefined();
    expect(body.skipped).toBeDefined();
    expect(body.total).toBe(2);
  });

  it("skips invalid emails", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/suppression/import",
      headers: authHeaders(adminToken()),
      payload: {
        emails: ["valid@test.com", "not-an-email", ""],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().skipped).toBe(2);
  });

  it("returns 400 when emails array is empty", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/suppression/import",
      headers: authHeaders(adminToken()),
      payload: { emails: [] },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("emails array is required");
  });

  it("returns 400 when emails is missing", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/suppression/import",
      headers: authHeaders(adminToken()),
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/suppression/import",
      headers: authHeaders(userToken()),
      payload: { emails: ["test@test.com"] },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/system-admin/suppression/export", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns export data for admin", async () => {
    const mockRows = [
      { email: "bounced@test.com", reason: "hard_bounce", bounceCount: 3, lastBounceAt: new Date(), createdAt: new Date() },
    ];
    app = await buildApp({ selectResult: mockRows });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/suppression/export",
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
      url: "/api/system-admin/suppression/export",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/system-admin/suppression/bounce-rate", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns bounce rate overview for admin", async () => {
    // db.execute() destructures [result], so must be an array
    app = await buildApp({
      executeResult: [{ total_sent: "1000", total_delivered: "950", total_bounced: "30", total_complained: "2" }],
      selectResult: [],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/suppression/bounce-rate",
      headers: authHeaders(adminToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.bounceRate).toBeDefined();
    expect(body.complaintRate).toBeDefined();
    expect(body.totalSent).toBeDefined();
    expect(body.days).toBe(7);
  });

  it("returns 403 for non-admin user", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/suppression/bounce-rate",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(403);
  });
});
