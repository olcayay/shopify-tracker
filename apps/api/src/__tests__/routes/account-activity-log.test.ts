import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  userToken,
  viewerToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";

const MOCK_LOG_ENTRY = {
  id: 1,
  action: "app_tracked",
  entityType: "app",
  entityId: "slack",
  metadata: { platform: "shopify", slug: "slack" },
  createdAt: new Date("2026-04-08T12:00:00Z"),
  user: { id: "user-001", name: "Test User", email: "user@test.com" },
};

async function buildActivityLogApp(dbOverrides = {}) {
  const { accountActivityLogRoutes } = await import(
    "../../routes/account-activity-log.js"
  );
  return buildTestApp({
    routes: accountActivityLogRoutes,
    prefix: "/api/account",
    db: dbOverrides,
  });
}

describe("GET /api/account/activity-log", () => {
  describe("authentication", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildActivityLogApp({
        selectResult: [{ total: 0 }],
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/activity-log",
      });
      expect(res.statusCode).toBe(401);
    });

    it("allows viewer role (any role can view)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/activity-log",
        headers: authHeaders(viewerToken()),
      });
      // Should not be 401 or 403
      expect(res.statusCode).toBe(200);
    });

    it("allows editor role", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/activity-log",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("pagination", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildActivityLogApp({
        selectResult: [{ total: 50 }],
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it("returns default pagination values", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/activity-log",
        headers: authHeaders(userToken()),
      });
      const body = res.json();
      expect(body.page).toBe(1);
      expect(body.limit).toBe(25);
    });

    it("accepts custom page and limit", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/activity-log?page=3&limit=10",
        headers: authHeaders(userToken()),
      });
      const body = res.json();
      expect(body.page).toBe(3);
      expect(body.limit).toBe(10);
    });

    it("clamps limit to 100 max", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/activity-log?limit=500",
        headers: authHeaders(userToken()),
      });
      const body = res.json();
      expect(body.limit).toBe(100);
    });

    it("defaults invalid page to 1", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/activity-log?page=abc",
        headers: authHeaders(userToken()),
      });
      const body = res.json();
      expect(body.page).toBe(1);
    });

    it("clamps negative page to 1", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/activity-log?page=-5",
        headers: authHeaders(userToken()),
      });
      const body = res.json();
      expect(body.page).toBe(1);
    });
  });

  describe("filtering", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildActivityLogApp({
        selectResult: [{ total: 0 }],
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it("accepts action filter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/activity-log?action=app_tracked",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("accepts entityType filter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/activity-log?entityType=app",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("accepts userId filter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/activity-log?userId=user-001",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("accepts combined filters", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/activity-log?action=app_tracked&entityType=app&userId=user-001&page=2&limit=10",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.page).toBe(2);
      expect(body.limit).toBe(10);
    });
  });

  describe("response shape", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      // Mock returns [{ total: 1 }] which satisfies both the logs query (returns array)
      // and the count query (destructures total)
      app = await buildActivityLogApp({
        selectResult: [{ total: 1 }],
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it("returns logs array with total, page, limit", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/activity-log",
        headers: authHeaders(userToken()),
      });
      const body = res.json();
      expect(body).toHaveProperty("logs");
      expect(body).toHaveProperty("total");
      expect(body).toHaveProperty("page");
      expect(body).toHaveProperty("limit");
      expect(Array.isArray(body.logs)).toBe(true);
      expect(typeof body.total).toBe("number");
      expect(body.total).toBe(1);
    });
  });
});
