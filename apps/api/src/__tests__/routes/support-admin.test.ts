import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  userToken,
  adminToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";

async function buildAdminSupportApp(dbOverrides = {}) {
  const { supportAdminRoutes } = await import("../../routes/support-admin.js");
  return buildTestApp({
    routes: supportAdminRoutes,
    prefix: "/api/system-admin/support-tickets",
    db: dbOverrides,
  });
}

describe("Admin Support Ticket Routes", () => {
  describe("auth guard", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildAdminSupportApp({
        selectResult: [],
        executeResult: [{ open_count: "0", awaiting_reply_count: "0", in_progress_count: "0", resolved_count: "0", closed_count: "0", unassigned_count: "0", total_count: "0" }],
      });
    });

    afterAll(async () => { await app.close(); });

    it("returns 401 without auth", async () => {
      const res = await app.inject({ method: "GET", url: "/api/system-admin/support-tickets" });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/support-tickets",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("allows system admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/support-tickets",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /stats", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildAdminSupportApp({
        executeResult: [{ open_count: "5", awaiting_reply_count: "3", in_progress_count: "2", resolved_count: "10", closed_count: "8", unassigned_count: "4", total_count: "28" }],
      });
    });

    afterAll(async () => { await app.close(); });

    it("returns aggregate stats", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/support-tickets/stats",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.open).toBe(5);
      expect(body.awaitingReply).toBe(3);
      expect(body.total).toBe(28);
      expect(body.unassigned).toBe(4);
    });
  });

  describe("GET /:ticketId — detail with internal notes", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildAdminSupportApp({
        selectResult: [{ id: "ticket-1", ticketNumber: 1, status: "open" }],
      });
    });

    afterAll(async () => { await app.close(); });

    it("returns ticket detail for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/support-tickets/ticket-1",
        headers: authHeaders(adminToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /:ticketId/messages — admin reply", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildAdminSupportApp({
        selectResult: [{ id: "ticket-1", status: "open" }],
        insertResult: [{ id: "msg-1", body: "Admin reply", createdAt: new Date() }],
      });
    });

    afterAll(async () => { await app.close(); });

    it("creates admin reply", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/support-tickets/ticket-1/messages",
        headers: authHeaders(adminToken()),
        payload: { body: "We are looking into this" },
      });
      expect(res.statusCode).toBe(201);
    });

    it("creates internal note", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/system-admin/support-tickets/ticket-1/messages",
        headers: authHeaders(adminToken()),
        payload: { body: "Internal note for team", isInternalNote: true },
      });
      expect(res.statusCode).toBe(201);
    });
  });

  describe("PATCH /:ticketId — update ticket", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildAdminSupportApp({
        selectResult: [{ id: "ticket-1", status: "open" }],
        insertResult: [{ id: "sys-msg-1" }],
      });
    });

    afterAll(async () => { await app.close(); });

    it("updates status and creates system message", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/system-admin/support-tickets/ticket-1",
        headers: authHeaders(adminToken()),
        payload: { status: "in_progress" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().changes).toContain("Status changed to in_progress");
    });

    it("returns 400 for invalid status", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/system-admin/support-tickets/ticket-1",
        headers: authHeaders(adminToken()),
        payload: { status: "invalid" },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
