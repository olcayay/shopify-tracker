import { buildTestApp, userToken, authHeaders, type MockDbOverrides } from "../helpers/test-app.js";
import { notificationRoutes } from "../../routes/notifications.js";
import type { FastifyInstance } from "fastify";

async function buildApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  return buildTestApp({
    routes: notificationRoutes,
    prefix: "/api/notifications",
    db,
  });
}

describe("GET /api/notifications", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns paginated notifications", async () => {
    const mockNotifs = [
      { id: "n1", type: "ranking_top3_entry", category: "ranking", title: "Test", isRead: false, createdAt: new Date() },
    ];
    app = await buildApp({ selectResult: mockNotifs });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications?limit=10",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.notifications).toBeDefined();
    expect(body.hasMore).toBeDefined();
  });

  it("requires authentication", async () => {
    app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/notifications" });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/notifications/unread-count", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns unread count", async () => {
    app = await buildApp({ selectResult: [{ count: 5 }] });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications/unread-count",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(5);
  });
});

describe("POST /api/notifications/:id/read", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns 404 when notification not found", async () => {
    // update().returning() resolves to [] in mock
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/notifications/nonexistent/read",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/notifications/read-all", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("marks all as read", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/notifications/read-all",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });
});

describe("POST /api/notifications/:id/archive", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns 404 when notification not found", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/notifications/nonexistent/archive",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/notifications/preferences", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns merged preferences", async () => {
    app = await buildApp({
      selectResult: [
        { notificationType: "ranking_top3_entry", inAppEnabled: true, pushDefaultEnabled: false },
      ],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications/preferences",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().preferences).toBeDefined();
  });
});

describe("PATCH /api/notifications/preferences/:type", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("updates single type preference", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/notifications/preferences/ranking_top3_entry",
      headers: authHeaders(userToken()),
      payload: { inAppEnabled: false, pushEnabled: true },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });
});

describe("PATCH /api/notifications/preferences", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("bulk updates preferences", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/notifications/preferences",
      headers: authHeaders(userToken()),
      payload: {
        preferences: [
          { type: "ranking_top3_entry", inAppEnabled: false },
          { type: "review_new_negative", pushEnabled: true },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().updated).toBe(2);
  });
});
