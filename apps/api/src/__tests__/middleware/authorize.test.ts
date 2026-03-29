/**
 * Tests for the authorize middleware (requireRole, requireSystemAdmin).
 *
 * These are preHandler hooks that check request.user after the auth
 * middleware has already decoded the JWT.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { requireRole, requireSystemAdmin } from "../../middleware/authorize.js";
import type { JwtPayload } from "../../middleware/auth.js";

const TEST_SECRET = "test-secret-key-for-testing-only";
process.env.JWT_SECRET = TEST_SECRET;

function signToken(payload: Partial<JwtPayload>): string {
  const defaults: JwtPayload = {
    userId: "user-001",
    email: "user@test.com",
    accountId: "account-001",
    role: "owner",
    isSystemAdmin: false,
  };
  return jwt.sign({ ...defaults, ...payload }, TEST_SECRET, { expiresIn: "15m" });
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Minimal auth: decode the JWT and set request.user
  app.decorateRequest("user", null as unknown as JwtPayload);
  app.decorateRequest("isImpersonating", false);
  app.addHook("onRequest", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    try {
      request.user = jwt.verify(authHeader.slice(7), TEST_SECRET) as JwtPayload;
    } catch {
      return reply.code(401).send({ error: "Invalid token" });
    }
  });

  // Routes with role guards
  app.get("/owner-only", { preHandler: [requireRole("owner")] }, async (req) => ({ ok: true, role: req.user.role }));
  app.get("/editor-or-owner", { preHandler: [requireRole("owner", "editor")] }, async (req) => ({ ok: true, role: req.user.role }));
  app.get("/any-role", { preHandler: [requireRole("owner", "editor", "viewer")] }, async (req) => ({ ok: true }));
  app.get("/admin-only", { preHandler: [requireSystemAdmin()] }, async (req) => ({ ok: true }));

  await app.ready();
  return app;
}

describe("requireRole middleware", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("allows owner to access owner-only route", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/owner-only",
      headers: { authorization: `Bearer ${signToken({ role: "owner" })}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().role).toBe("owner");
  });

  it("blocks editor from owner-only route", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/owner-only",
      headers: { authorization: `Bearer ${signToken({ role: "editor" })}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Insufficient permissions");
  });

  it("blocks viewer from owner-only route", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/owner-only",
      headers: { authorization: `Bearer ${signToken({ role: "viewer" })}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("allows editor to access editor-or-owner route", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/editor-or-owner",
      headers: { authorization: `Bearer ${signToken({ role: "editor" })}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().role).toBe("editor");
  });

  it("allows owner to access editor-or-owner route", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/editor-or-owner",
      headers: { authorization: `Bearer ${signToken({ role: "owner" })}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("blocks viewer from editor-or-owner route", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/editor-or-owner",
      headers: { authorization: `Bearer ${signToken({ role: "viewer" })}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("allows all roles on any-role route", async () => {
    for (const role of ["owner", "editor", "viewer"] as const) {
      const res = await app.inject({
        method: "GET",
        url: "/any-role",
        headers: { authorization: `Bearer ${signToken({ role })}` },
      });
      expect(res.statusCode).toBe(200);
    }
  });
});

describe("requireSystemAdmin middleware", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("allows system admin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin-only",
      headers: { authorization: `Bearer ${signToken({ isSystemAdmin: true })}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("blocks non-system-admin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin-only",
      headers: { authorization: `Bearer ${signToken({ isSystemAdmin: false })}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Forbidden");
  });

  it("blocks when user is undefined (no auth)", async () => {
    // Build a separate app without the auth hook to simulate missing user
    const bareApp = Fastify({ logger: false });
    bareApp.decorateRequest("user", null as unknown as JwtPayload);
    bareApp.get("/admin-bare", { preHandler: [requireSystemAdmin()] }, async () => ({ ok: true }));
    await bareApp.ready();

    const res = await bareApp.inject({ method: "GET", url: "/admin-bare" });
    expect(res.statusCode).toBe(403);
    await bareApp.close();
  });
});
