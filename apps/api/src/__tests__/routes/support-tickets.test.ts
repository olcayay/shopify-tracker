import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import jwt from "jsonwebtoken";
import {
  buildTestApp,
  userToken,
  viewerToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";

async function buildSupportApp(dbOverrides = {}) {
  const { supportTicketRoutes } = await import("../../routes/support-tickets.js");
  return buildTestApp({
    routes: supportTicketRoutes,
    prefix: "/api/support-tickets",
    db: dbOverrides,
  });
}

/** Build app with a DB mock that throws on every query (simulates missing table / DB error) */
async function buildSupportAppWithDbError() {
  const TEST_JWT_SECRET = "test-secret-key-for-testing-only";
  const { supportTicketRoutes } = await import("../../routes/support-tickets.js");
  const app = Fastify({ logger: false });

  app.setErrorHandler((error, _request, reply) => {
    reply.code(error.statusCode ?? 500).send({ error: error.message || "Internal Server Error" });
  });

  const dbError = new Error('relation "support_tickets" does not exist');
  const throwingChain: any = {};
  const methods = [
    "select", "selectDistinctOn", "from", "where", "leftJoin", "innerJoin",
    "orderBy", "groupBy", "limit", "offset", "insert", "values", "returning",
    "onConflictDoUpdate", "onConflictDoNothing", "update", "set", "delete",
  ];
  for (const m of methods) {
    throwingChain[m] = () => throwingChain;
  }
  throwingChain.then = (_resolve: any, reject?: any) => {
    return Promise.reject(dbError).then(undefined, reject || ((e: any) => { throw e; }));
  };

  const mockDb: any = {
    select: () => throwingChain,
    insert: () => throwingChain,
    update: () => throwingChain,
    delete: () => throwingChain,
    execute: () => Promise.reject(dbError),
    transaction: async (fn: any) => fn({
      select: () => throwingChain,
      insert: () => throwingChain,
      update: () => throwingChain,
      delete: () => throwingChain,
      execute: () => Promise.reject(dbError),
    }),
  };

  app.decorate("db", mockDb);
  app.decorateRequest("user", null as any);
  app.decorateRequest("isImpersonating", false);

  app.addHook("onRequest", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    try {
      request.user = jwt.verify(authHeader.slice(7), TEST_JWT_SECRET) as any;
    } catch {
      return reply.code(401).send({ error: "Invalid or expired token" });
    }
  });

  await app.register(
    async (instance) => {
      instance.db = mockDb;
      await supportTicketRoutes(instance);
    },
    { prefix: "/api/support-tickets" }
  );

  await app.ready();
  return app;
}

describe("Support Ticket Routes", () => {
  describe("POST /api/support-tickets — create ticket", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildSupportApp({
        insertResult: [{
          id: "ticket-1",
          ticketNumber: 1,
          type: "bug_report",
          subject: "Test bug",
          status: "open",
          priority: "normal",
          createdAt: new Date().toISOString(),
        }],
      });
    });

    afterAll(async () => { await app.close(); });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/support-tickets",
        payload: { type: "bug_report", subject: "Test", body: "Details" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 for missing fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/support-tickets",
        headers: authHeaders(userToken()),
        payload: { type: "bug_report" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for invalid type", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/support-tickets",
        headers: authHeaders(userToken()),
        payload: { type: "invalid_type", subject: "Test", body: "Details" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Invalid type");
    });

    it("creates ticket with valid input", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/support-tickets",
        headers: authHeaders(userToken()),
        payload: { type: "bug_report", subject: "Test bug", body: "The app crashes" },
      });
      expect(res.statusCode).toBe(201);
    });
  });

  describe("GET /api/support-tickets — list tickets", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildSupportApp({
        selectResult: [{
          id: "ticket-1",
          ticketNumber: 1,
          type: "bug_report",
          subject: "Test",
          status: "open",
          priority: "normal",
          lastMessageAt: new Date(),
          createdAt: new Date(),
          createdByName: "Test User",
          createdByEmail: "user@test.com",
        }],
      });
    });

    afterAll(async () => { await app.close(); });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/support-tickets",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns tickets with pagination", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/support-tickets",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("items");
      expect(body).toHaveProperty("nextCursor");
    });

    it("accepts status and type filters", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/support-tickets?status=open&type=bug_report",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/support-tickets/:ticketId — ticket detail", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildSupportApp({
        selectResult: [{
          id: "ticket-1",
          accountId: "account-001",
          status: "open",
        }],
      });
    });

    afterAll(async () => { await app.close(); });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/support-tickets/ticket-1",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns ticket detail", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/support-tickets/ticket-1",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/support-tickets/:ticketId/messages — reply", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildSupportApp({
        selectResult: [{ id: "ticket-1", status: "open", accountId: "account-001" }],
        insertResult: [{ id: "msg-1", body: "Reply", createdAt: new Date() }],
      });
    });

    afterAll(async () => { await app.close(); });

    it("returns 400 for empty body", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/support-tickets/ticket-1/messages",
        headers: authHeaders(userToken()),
        payload: { body: "" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("creates reply with valid body", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/support-tickets/ticket-1/messages",
        headers: authHeaders(userToken()),
        payload: { body: "Here is my reply" },
      });
      expect(res.statusCode).toBe(201);
    });
  });

  describe("POST /api/support-tickets/:ticketId/close", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildSupportApp({
        selectResult: [{ id: "ticket-1", status: "open", accountId: "account-001" }],
      });
    });

    afterAll(async () => { await app.close(); });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/support-tickets/ticket-1/close",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer role", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/support-tickets/ticket-1/close",
        headers: authHeaders(viewerToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("closes ticket for owner/editor", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/support-tickets/ticket-1/close",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().message).toBe("Ticket closed");
    });
  });

  describe("DB error handling", () => {
    it("returns 503 when list query fails", async () => {
      const app = await buildSupportAppWithDbError();
      const res = await app.inject({
        method: "GET",
        url: "/api/support-tickets",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.error).toContain("Failed to load support tickets");
      expect(body.code).toBe("TABLE_OR_COLUMN_MISSING");
      await app.close();
    });

    it("returns 503 when ticket detail query fails", async () => {
      const app = await buildSupportAppWithDbError();
      const res = await app.inject({
        method: "GET",
        url: "/api/support-tickets/ticket-1",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.error).toContain("Failed to load ticket");
      expect(body.code).toBe("TABLE_OR_COLUMN_MISSING");
      await app.close();
    });

    it("returns 503 when create ticket fails", async () => {
      const app = await buildSupportAppWithDbError();
      const res = await app.inject({
        method: "POST",
        url: "/api/support-tickets",
        headers: authHeaders(userToken()),
        payload: { type: "bug_report", subject: "Test", body: "Details" },
      });
      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.error).toContain("Failed to create ticket");
      expect(body.code).toBe("TABLE_OR_COLUMN_MISSING");
      await app.close();
    });
  });
});
