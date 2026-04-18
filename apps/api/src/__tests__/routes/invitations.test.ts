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
  updateResult?: any[];
}) {
  let selectCall = 0;
  const db: any = {
    select: (..._args: any[]) => {
      const idx = selectCall++;
      const result = opts.selectResults[idx] ?? [];
      return makeChain(result);
    },
    insert: (..._args: any[]) => makeChain(opts.insertResult ?? []),
    update: (..._args: any[]) => makeChain(opts.updateResult ?? []),
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

  // Global error handler (mirrors production in src/index.ts)
  app.setErrorHandler((error: any, _request, reply) => {
    if (error.name === "ApiError") {
      return reply.code(error.statusCode).send(error.toJSON());
    }
    if (error.name === "ZodError") {
      const fieldErrors = error.issues.map((issue: any) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return reply.code(400).send({
        error: "Validation failed",
        details: fieldErrors,
      });
    }
    reply.code(error.statusCode ?? 500).send({
      error: error.message || "Internal Server Error",
    });
  });

  app.decorate("db", mockDb);
  app.decorate("writeDb", mockDb);
  app.decorateRequest("user", null as any);
  app.decorateRequest("isImpersonating", false);
  // Invitation routes are public (no auth hook needed)
  await app.register(
    async (instance) => {
      (instance as any).db = mockDb;
      (instance as any).writeDb = mockDb;
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
    // Joined shape: the GET handler now does leftJoin on users + accounts
    const validJoined = {
      email: validInvitation.email,
      role: validInvitation.role,
      expiresAt: validInvitation.expiresAt,
      acceptedAt: validInvitation.acceptedAt,
      inviterName: "John Owner",
      accountName: "Acme Corp",
      accountCompany: "Acme Inc.",
    };

    it("returns invitation details with inviter and account info", async () => {
      const app = await buildTestApp({
        routes: invitationRoutes,
        prefix: "/api/invitations",
        db: { selectResult: [validJoined] },
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/invitations/valid-token-123",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("email", "newuser@test.com");
      expect(body).toHaveProperty("role", "editor");
      expect(body).toHaveProperty("expired", false);
      expect(body).toHaveProperty("accepted", false);
      expect(body).toHaveProperty("inviterName", "John Owner");
      expect(body).toHaveProperty("accountName", "Acme Corp");
      expect(body).toHaveProperty("accountCompany", "Acme Inc.");

      await app.close();
    });

    it("defaults inviterName when inviter is null", async () => {
      const app = await buildTestApp({
        routes: invitationRoutes,
        prefix: "/api/invitations",
        db: { selectResult: [{ ...validJoined, inviterName: null }] },
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/invitations/valid-token-123",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().inviterName).toBe("A team member");

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
      const expired = {
        ...validJoined,
        expiresAt: new Date(Date.now() - 86400_000),
      };
      const app = await buildTestApp({
        routes: invitationRoutes,
        prefix: "/api/invitations",
        db: { selectResult: [expired] },
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
      const accepted = {
        ...validJoined,
        acceptedAt: new Date(),
      };
      const app = await buildTestApp({
        routes: invitationRoutes,
        prefix: "/api/invitations",
        db: { selectResult: [accepted] },
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
      const mockDb = buildSequentialMockDb({ selectResults: [] });
      const app = await buildInvitationApp(mockDb);

      const res = await app.inject({
        method: "POST",
        url: "/api/invitations/accept/valid-token-123",
        payload: { password: "securepass123" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Validation failed");

      await app.close();
    });

    it("returns 400 when password is missing", async () => {
      const mockDb = buildSequentialMockDb({ selectResults: [] });
      const app = await buildInvitationApp(mockDb);

      const res = await app.inject({
        method: "POST",
        url: "/api/invitations/accept/valid-token-123",
        payload: { name: "New User" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Validation failed");

      await app.close();
    });

    it("returns 400 when password is too short", async () => {
      const mockDb = buildSequentialMockDb({ selectResults: [] });
      const app = await buildInvitationApp(mockDb);

      const res = await app.inject({
        method: "POST",
        url: "/api/invitations/accept/valid-token-123",
        payload: { name: "New User", password: "short" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Validation failed");
      expect(res.json().details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "password" }),
        ])
      );

      await app.close();
    });

    it("transfers user to invited account when already registered in another account", async () => {
      const existingUser = {
        id: "user-existing",
        email: "newuser@test.com",
        name: "Existing",
        accountId: "other-account-999",
      };
      const mockDb = buildSequentialMockDb({
        selectResults: [[validInvitation], [existingUser]],
        updateResult: [{ ...existingUser, accountId: "account-001", role: "editor" }],
      });
      const app = await buildInvitationApp(mockDb);

      const res = await app.inject({
        method: "POST",
        url: "/api/invitations/accept/valid-token-123",
        payload: { name: "New User", password: "securepass123" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe("TRANSFERRED");
      expect(body.message).toContain("moved to the new organization");

      await app.close();
    });

    it("returns 409 when user is already a member of the same account", async () => {
      const existingUser = {
        id: "user-existing",
        email: "newuser@test.com",
        name: "Existing",
        accountId: "account-001", // same as invitation
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

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe("ALREADY_MEMBER");
      expect(body.message).toContain("already a member");

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

    it("sets emailVerifiedAt when creating user via invitation", async () => {
      let capturedValues: any = null;
      const mockDb = buildSequentialMockDb({
        selectResults: [[validInvitation], []],
        insertResult: [createdUser],
      });
      // Intercept the insert to capture values
      const origInsert = mockDb.insert.bind(mockDb);
      mockDb.insert = (...args: any[]) => {
        const chain = origInsert(...args);
        const origValues = chain.values.bind(chain);
        chain.values = (vals: any) => {
          capturedValues = vals;
          return origValues(vals);
        };
        return chain;
      };
      const app = await buildInvitationApp(mockDb);

      await app.inject({
        method: "POST",
        url: "/api/invitations/accept/valid-token-123",
        payload: { name: "New User", password: "securepass123" },
      });

      expect(capturedValues).not.toBeNull();
      expect(capturedValues.emailVerifiedAt).toBeInstanceOf(Date);

      await app.close();
    });
  });
});
