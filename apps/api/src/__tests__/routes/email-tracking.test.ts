import Fastify, { type FastifyInstance } from "fastify";
import { createMockDb, type MockDbOverrides } from "../helpers/test-app.js";
import { emailTrackingRoutes } from "../../routes/email-tracking.js";

async function buildEmailTestApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const mockDb = createMockDb(db);
  app.decorate("db", mockDb);
  await app.register(
    async (instance) => {
      instance.db = mockDb;
      await emailTrackingRoutes(instance);
    },
    { prefix: "/api/emails" }
  );
  await app.ready();
  return app;
}

describe("GET /api/emails/track/open/:logId.png", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) await app.close();
  });

  it("returns a transparent PNG image", async () => {
    app = await buildEmailTestApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/emails/track/open/test-log-id.png",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["cache-control"]).toContain("no-store");
  });

  it("does not require authentication", async () => {
    app = await buildEmailTestApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/emails/track/open/any-id.png",
    });

    expect(res.statusCode).toBe(200);
  });
});

describe("GET /api/emails/track/click/:logId/:linkIndex", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) await app.close();
  });

  it("redirects to original URL from linkMap", async () => {
    app = await buildEmailTestApp({
      selectResult: [{
        dataSnapshot: { linkMap: { "0": "https://example.com/target" } },
      }],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/emails/track/click/test-log-id/0",
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://example.com/target");
  });

  it("redirects to appranks.io when no linkMap found", async () => {
    app = await buildEmailTestApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/emails/track/click/nonexistent/0",
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://appranks.io");
  });
});

describe("GET /api/emails/unsubscribe/:token", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) await app.close();
  });

  it("returns 404 for invalid token", async () => {
    app = await buildEmailTestApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/emails/unsubscribe/invalid-token",
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).toContain("invalid or has expired");
  });

  it("shows confirmation page for valid token", async () => {
    app = await buildEmailTestApp({
      selectResult: [{ id: "tok-1", emailType: "daily_digest", usedAt: null }],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/emails/unsubscribe/valid-token",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("Daily Digest");
    expect(res.body).toContain("Confirm Unsubscribe");
  });

  it("shows already unsubscribed for used token", async () => {
    app = await buildEmailTestApp({
      selectResult: [{ id: "tok-1", emailType: "daily_digest", usedAt: new Date() }],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/emails/unsubscribe/used-token",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("already been unsubscribed");
  });
});

describe("POST /api/emails/unsubscribe/:token", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) await app.close();
  });

  it("returns 404 for invalid token", async () => {
    app = await buildEmailTestApp({ selectResult: [] });

    const res = await app.inject({
      method: "POST",
      url: "/api/emails/unsubscribe/invalid-token",
    });

    expect(res.statusCode).toBe(404);
  });

  it("processes unsubscribe for valid token", async () => {
    app = await buildEmailTestApp({
      selectResult: [{ id: "tok-1", userId: "user-1", emailType: "daily_digest", usedAt: null }],
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/emails/unsubscribe/valid-token",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("been unsubscribed");
    expect(res.body).toContain("Daily Digest");
  });
});
