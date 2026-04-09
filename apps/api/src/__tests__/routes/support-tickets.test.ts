import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
});
