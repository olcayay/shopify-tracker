import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  createMockDb,
  userToken,
  adminToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";
import { invitationRoutes } from "../../routes/invitations.js";

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const validInvitation = {
  id: "inv-001",
  token: "valid-token-123",
  email: "newuser@test.com",
  accountId: "account-001",
  role: "editor",
  expiresAt: new Date(Date.now() + 86400_000), // +24h
  acceptedAt: null,
  createdAt: new Date(),
};

const expiredInvitation = {
  ...validInvitation,
  token: "expired-token",
  expiresAt: new Date(Date.now() - 86400_000), // -24h
};

const acceptedInvitation = {
  ...validInvitation,
  token: "accepted-token",
  acceptedAt: new Date(),
};

const createdUser = {
  id: "user-new-001",
  email: "newuser@test.com",
  name: "New User",
  role: "editor",
  accountId: "account-001",
};

// ---------------------------------------------------------------------------
// Helper: build a sequential mock DB where each select() call returns a
// different result from the provided array (in order).
// ---------------------------------------------------------------------------

function buildSequentialMockDb(opts: {
  selectResults: any[][];
  insertResult?: any[];
}) {
  let selectCall = 0;
  const db: any = {
    select: (..._args: any[]) => {
      const idx = selectCall++;
      const result = opts.selectResults[idx] ?? [];
      return makeChain(result);
    },
    insert: (..._args: any[]) => makeChain(opts.insertResult ?? []),
    update: (..._args: any[]) => makeChain([]),
    delete: (..._args: any[]) => makeChain([]),
    execute: (..._args: any[]) => Promise.resolve([]),
  };
  return db;
}

function makeChain(resolveValue: any) {
  const chain: any = {};
  const methods = [
    "select", "from", "where", "leftJoin", "innerJoin", "rightJoin",
    "orderBy", "groupBy", "limit", "offset", "as", "having",
    "insert", "values", "returning", "onConflictDoUpdate", "onConflictDoNothing",
    "update", "set", "delete",
  ];
  for (const m of methods) {
    chain[m] = (..._a: any[]) => chain;
  }
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(resolveValue).then(resolve, reject);
  return chain;
}

/** Build a Fastify app with invitationRoutes using a custom mock DB object */
async function buildInvitationApp(mockDb: any): Promise<FastifyInstance> {
  const Fastify = (await import("fastify")).default;
  const app = Fastify({ logger: false });
  app.decorate("db", mockDb);
  app.decorateRequest("user", null as any);
  app.decorateRequest("isImpersonating", false);
  // Invitation routes are public (no auth hook needed)
  await app.register(
    async (instance) => {
      (instance as any).db = mockDb;
      await invitationRoutes(instance);
    },
    { prefix: "/api/invitations" }
  );
  await app.ready();
  return app;
}

describe("Invitation routes", () => {
  // -----------------------------------------------------------------------
  // GET /api/invitations/:token — public route, no auth needed
  // -----------------------------------------------------------------------

  describe("GET /api/invitations/:token", () => {
    it("returns invitation details for a valid token", async () => {
      const app = await buildTestApp({
        routes: invitationRoutes,
        prefix: "/api/invitations",
        db: { selectResult: [validInvitation] },
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/invitations/valid-token-123",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("email", "newuser@test.com");
      expect(body).toHaveProperty("role", "editor");
      expect(body).toHaveProperty("expired");
      expect(body).toHaveProperty("accepted");
      expect(body.accepted).toBe(false);

      await app.close();
    });

    it("returns 404 for unknown token", async () => {
      const app = await buildTestApp({
        routes: invitationRoutes,
        prefix: "/api/invitations",
        db: { selectResult: [] },
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/invitations/nonexistent-token",
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Invitation not found" });

      await app.close();
    });

    it("indicates when invitation is expired", async () => {
      const app = await buildTestApp({
        routes: invitationRoutes,
        prefix: "/api/invitations",
        db: { selectResult: [expiredInvitation] },
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/invitations/expired-token",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().expired).toBe(true);

      await app.close();
    });

    it("indicates when invitation is already accepted", async () => {
      const app = await buildTestApp({
        routes: invitationRoutes,
        prefix: "/api/invitations",
        db: { selectResult: [acceptedInvitation] },
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/invitations/accepted-token",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().accepted).toBe(true);

      await app.close();
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/invitations/accept/:token
  // -----------------------------------------------------------------------

  describe("POST /api/invitations/accept/:token", () => {
    it("returns 404 when invitation token is not found", async () => {
      const app = await buildTestApp({
        routes: invitationRoutes,
        prefix: "/api/invitations",
        db: { selectResult: [] },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/invitations/accept/bad-token",
        payload: { name: "Test User", password: "securepass123" },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Invitation not found" });

      await app.close();
    });

    it("returns 400 when invitation is already accepted", async () => {
      const app = await buildTestApp({
        routes: invitationRoutes,
        prefix: "/api/invitations",
        db: { selectResult: [acceptedInvitation] },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/invitations/accept/accepted-token",
        payload: { name: "Test User", password: "securepass123" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: "Invitation already accepted" });

      await app.close();
    });

    it("returns 400 when invitation is expired", async () => {
      const app = await buildTestApp({
        routes: invitationRoutes,
        prefix: "/api/invitations",
        db: { selectResult: [expiredInvitation] },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/invitations/accept/expired-token",
        payload: { name: "Test User", password: "securepass123" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: "Invitation expired" });

      await app.close();
    });

    it("returns 400 when name is missing", async () => {
      // Sequential mock: 1st select = invitation found, 2nd select = no existing user
      const mockDb = buildSequentialMockDb({
        selectResults: [[validInvitation], []],
      });
      const app = await buildInvitationApp(mockDb);

      const res = await app.inject({
        method: "POST",
        url: "/api/invitations/accept/valid-token-123",
        payload: { password: "securepass123" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({
        error: "name and password are required to accept invitation",
      });

      await app.close();
    });

    it("returns 400 when password is missing", async () => {
      const mockDb = buildSequentialMockDb({
        selectResults: [[validInvitation], []],
      });
      const app = await buildInvitationApp(mockDb);

      const res = await app.inject({
        method: "POST",
        url: "/api/invitations/accept/valid-token-123",
        payload: { name: "New User" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({
        error: "name and password are required to accept invitation",
      });

      await app.close();
    });

    it("returns 400 when password is too short", async () => {
      const mockDb = buildSequentialMockDb({
        selectResults: [[validInvitation], []],
      });
      const app = await buildInvitationApp(mockDb);

      const res = await app.inject({
        method: "POST",
        url: "/api/invitations/accept/valid-token-123",
        payload: { name: "New User", password: "short" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({
        error: "Password must be at least 8 characters",
      });

      await app.close();
    });

    it("returns 409 when user with email already exists", async () => {
      // Both selects return non-empty: 1st = invitation, 2nd = existing user
      const existingUser = {
        id: "user-existing",
        email: "newuser@test.com",
        name: "Existing",
      };
      const mockDb = buildSequentialMockDb({
        selectResults: [[validInvitation], [existingUser]],
      });
      const app = await buildInvitationApp(mockDb);

      const res = await app.inject({
        method: "POST",
        url: "/api/invitations/accept/valid-token-123",
        payload: { name: "New User", password: "securepass123" },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({
        error: "User with this email already exists",
      });

      await app.close();
    });

    it("accepts invitation and creates user on success", async () => {
      const mockDb = buildSequentialMockDb({
        selectResults: [[validInvitation], []],
        insertResult: [createdUser],
      });
      const app = await buildInvitationApp(mockDb);

      const res = await app.inject({
        method: "POST",
        url: "/api/invitations/accept/valid-token-123",
        payload: { name: "New User", password: "securepass123" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.message).toBe("Invitation accepted");
      expect(body.user).toEqual({
        id: "user-new-001",
        email: "newuser@test.com",
        name: "New User",
        role: "editor",
      });

      await app.close();
    });
  });
});
