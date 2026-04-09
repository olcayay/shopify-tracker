/**
 * Tests for the authorize middleware (requireRole, requireSystemAdmin).
 *
 * These are preHandler hooks that check request.user after the auth
 * middleware has already decoded the JWT.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { requireRole, requireSystemAdmin, canManageRole, hasRoleLevel } from "../../middleware/authorize.js";
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
  app.get("/editor-or-owner", { preHandler: [requireRole("owner", "admin", "editor")] }, async (req) => ({ ok: true, role: req.user.role }));
  app.get("/owner-or-admin", { preHandler: [requireRole("owner", "admin")] }, async (req) => ({ ok: true, role: req.user.role }));
  app.get("/any-role", { preHandler: [requireRole("owner", "admin", "editor", "viewer")] }, async (req) => ({ ok: true }));
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
    for (const role of ["owner", "admin", "editor", "viewer"] as const) {
      const res = await app.inject({
        method: "GET",
        url: "/any-role",
        headers: { authorization: `Bearer ${signToken({ role })}` },
      });
      expect(res.statusCode).toBe(200);
    }
  });

  it("allows admin to access owner-or-admin route", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/owner-or-admin",
      headers: { authorization: `Bearer ${signToken({ role: "admin" })}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().role).toBe("admin");
  });

  it("blocks editor from owner-or-admin route", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/owner-or-admin",
      headers: { authorization: `Bearer ${signToken({ role: "editor" })}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("blocks viewer from owner-or-admin route", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/owner-or-admin",
      headers: { authorization: `Bearer ${signToken({ role: "viewer" })}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("allows admin to access editor-or-owner route", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/editor-or-owner",
      headers: { authorization: `Bearer ${signToken({ role: "admin" })}` },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("canManageRole", () => {
  it("owner can manage all other roles", () => {
    expect(canManageRole("owner", "admin")).toBe(true);
    expect(canManageRole("owner", "editor")).toBe(true);
    expect(canManageRole("owner", "viewer")).toBe(true);
  });

  it("admin can manage editor and viewer", () => {
    expect(canManageRole("admin", "editor")).toBe(true);
    expect(canManageRole("admin", "viewer")).toBe(true);
  });

  it("admin cannot manage owner or other admins", () => {
    expect(canManageRole("admin", "owner")).toBe(false);
    expect(canManageRole("admin", "admin")).toBe(false);
  });

  it("editor can manage viewer but not peers or above", () => {
    expect(canManageRole("editor", "viewer")).toBe(true);
    expect(canManageRole("editor", "editor")).toBe(false);
    expect(canManageRole("editor", "admin")).toBe(false);
    expect(canManageRole("editor", "owner")).toBe(false);
  });

  it("viewer cannot manage anyone", () => {
    expect(canManageRole("viewer", "viewer")).toBe(false);
    expect(canManageRole("viewer", "editor")).toBe(false);
  });

  it("owner cannot manage themselves (same level)", () => {
    expect(canManageRole("owner", "owner")).toBe(false);
  });
});

describe("hasRoleLevel", () => {
  it("owner has all role levels", () => {
    expect(hasRoleLevel("owner", "owner")).toBe(true);
    expect(hasRoleLevel("owner", "admin")).toBe(true);
    expect(hasRoleLevel("owner", "editor")).toBe(true);
    expect(hasRoleLevel("owner", "viewer")).toBe(true);
  });

  it("admin has admin level and below", () => {
    expect(hasRoleLevel("admin", "admin")).toBe(true);
    expect(hasRoleLevel("admin", "editor")).toBe(true);
    expect(hasRoleLevel("admin", "viewer")).toBe(true);
    expect(hasRoleLevel("admin", "owner")).toBe(false);
  });

  it("editor has editor level and below", () => {
    expect(hasRoleLevel("editor", "editor")).toBe(true);
    expect(hasRoleLevel("editor", "viewer")).toBe(true);
    expect(hasRoleLevel("editor", "admin")).toBe(false);
  });

  it("viewer only has viewer level", () => {
    expect(hasRoleLevel("viewer", "viewer")).toBe(true);
    expect(hasRoleLevel("viewer", "editor")).toBe(false);
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
