/**
 * Tests for the auth middleware behavior.
 *
 * The test helper (buildTestApp) installs an onRequest hook that mirrors
 * the real auth middleware: checks for Bearer token, verifies JWT,
 * sets request.user and request.isImpersonating, and enforces
 * system-admin route access.
 *
 * These tests register a minimal route plugin behind the middleware
 * to verify that the middleware correctly allows or blocks requests.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import jwt from "jsonwebtoken";
import {
  buildTestApp,
  generateTestToken,
  adminToken,
  userToken,
  viewerToken,
  impersonationToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";

const TEST_JWT_SECRET = "test-secret-key-for-testing-only";

// ---------------------------------------------------------------------------
// A minimal route plugin that echoes the request.user back to the caller.
// This lets us assert what the middleware sets on the request.
// ---------------------------------------------------------------------------
async function echoRoutes(app: FastifyInstance) {
  // Protected endpoint that returns the user payload set by middleware
  app.get("/protected", async (request) => {
    return {
      user: request.user,
      isImpersonating: request.isImpersonating,
    };
  });

  // Simulates a system-admin route
  app.get("/system-admin/dashboard", async (request) => {
    return { ok: true, user: request.user };
  });
}

// ---------------------------------------------------------------------------
// Auth header checks
// ---------------------------------------------------------------------------

describe("Auth middleware — missing or invalid auth header", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: echoRoutes,
      prefix: "/api",
      db: { selectResult: [] },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 when no Authorization header is provided", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/protected",
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/unauthorized/i);
  });

  it("returns 401 when Authorization header has no Bearer prefix", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/protected",
      headers: { authorization: "Basic dXNlcjpwYXNz" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/unauthorized/i);
  });

  it("returns 401 when Authorization header is just 'Bearer' with no token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/protected",
      headers: { authorization: "Bearer " },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when token is garbage (not a valid JWT)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/protected",
      headers: authHeaders("not-a-real-jwt"),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/invalid|expired/i);
  });

  it("returns 401 when token is signed with wrong secret", async () => {
    const wrongToken = jwt.sign(
      { userId: "user-001", email: "a@b.com", accountId: "acc-1", role: "owner", isSystemAdmin: false },
      "wrong-secret",
      { expiresIn: "15m" }
    );
    const res = await app.inject({
      method: "GET",
      url: "/api/protected",
      headers: authHeaders(wrongToken),
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when token is expired", async () => {
    const expiredToken = jwt.sign(
      { userId: "user-001", email: "a@b.com", accountId: "acc-1", role: "owner", isSystemAdmin: false },
      TEST_JWT_SECRET,
      { expiresIn: "0s" }
    );
    const res = await app.inject({
      method: "GET",
      url: "/api/protected",
      headers: authHeaders(expiredToken),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/invalid|expired/i);
  });
});

// ---------------------------------------------------------------------------
// Valid token — request.user population
// ---------------------------------------------------------------------------

describe("Auth middleware — valid token sets request.user", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: echoRoutes,
      prefix: "/api",
      db: { selectResult: [] },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("sets user payload from a regular user token", async () => {
    const token = userToken();
    const res = await app.inject({
      method: "GET",
      url: "/api/protected",
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user).toBeDefined();
    expect(body.user.userId).toBe("user-001");
    expect(body.user.email).toBe("user@test.com");
    expect(body.user.role).toBe("editor");
    expect(body.user.isSystemAdmin).toBe(false);
    expect(body.isImpersonating).toBe(false);
  });

  it("sets user payload from an admin token", async () => {
    const token = adminToken();
    const res = await app.inject({
      method: "GET",
      url: "/api/protected",
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.userId).toBe("admin-001");
    expect(body.user.isSystemAdmin).toBe(true);
    expect(body.isImpersonating).toBe(false);
  });

  it("sets user payload from a viewer token", async () => {
    const token = viewerToken();
    const res = await app.inject({
      method: "GET",
      url: "/api/protected",
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.userId).toBe("viewer-001");
    expect(body.user.role).toBe("viewer");
  });

  it("preserves all JWT payload fields in request.user", async () => {
    const token = generateTestToken({
      userId: "custom-001",
      email: "custom@test.com",
      accountId: "account-custom",
      role: "owner",
      isSystemAdmin: false,
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/protected",
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.userId).toBe("custom-001");
    expect(body.user.email).toBe("custom@test.com");
    expect(body.user.accountId).toBe("account-custom");
    expect(body.user.role).toBe("owner");
    expect(body.user.isSystemAdmin).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Impersonation flag
// ---------------------------------------------------------------------------

describe("Auth middleware — impersonation detection", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: echoRoutes,
      prefix: "/api",
      db: { selectResult: [] },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("sets isImpersonating to true when realAdmin is present", async () => {
    const token = impersonationToken();
    const res = await app.inject({
      method: "GET",
      url: "/api/protected",
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.isImpersonating).toBe(true);
    expect(body.user.realAdmin).toBeDefined();
    expect(body.user.realAdmin.userId).toBe("admin-001");
  });

  it("sets isImpersonating to false when realAdmin is absent", async () => {
    const token = userToken();
    const res = await app.inject({
      method: "GET",
      url: "/api/protected",
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().isImpersonating).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// System admin route protection
// ---------------------------------------------------------------------------

describe("Auth middleware — system-admin route protection", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: echoRoutes,
      prefix: "/api",
      db: { selectResult: [] },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 403 for non-admin accessing /api/system-admin/*", async () => {
    const token = userToken(); // isSystemAdmin: false
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/dashboard",
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatch(/forbidden/i);
  });

  it("allows system admin to access /api/system-admin/*", async () => {
    const token = adminToken(); // isSystemAdmin: true
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/dashboard",
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it("allows impersonation token (isSystemAdmin: true) to access /api/system-admin/*", async () => {
    const token = impersonationToken(); // isSystemAdmin: true (from realAdmin)
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/dashboard",
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns 403 for viewer accessing /api/system-admin/*", async () => {
    const token = viewerToken(); // isSystemAdmin: false
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/dashboard",
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// OPTIONS requests skip auth (preflight)
// ---------------------------------------------------------------------------

describe("Auth middleware — OPTIONS preflight bypass", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: echoRoutes,
      prefix: "/api",
      db: { selectResult: [] },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("does not require auth for OPTIONS requests", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/protected",
    });
    // OPTIONS should not be blocked by the middleware (no 401)
    expect(res.statusCode).not.toBe(401);
  });
});
