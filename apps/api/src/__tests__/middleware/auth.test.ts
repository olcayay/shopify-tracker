/**
 * Comprehensive tests for the auth middleware using the REAL registerAuthMiddleware.
 *
 * Unlike middleware-auth.test.ts (which uses the simplified buildTestApp helper),
 * these tests exercise the actual auth middleware including:
 * - Token blacklist checks (jti-based)
 * - User-level token revocation (iat-based)
 * - Account suspension checks
 * - Impersonated user existence validation
 * - Public path bypass
 * - getJwtSecret validation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { registerAuthMiddleware, getJwtSecret, type JwtPayload } from "../../middleware/auth.js";

const TEST_SECRET = "test-secret-key-for-testing-only";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock token-blacklist module
vi.mock("../../utils/token-blacklist.js", () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
  isUserTokenRevoked: vi.fn().mockResolvedValue(false),
}));

import { isTokenBlacklisted, isUserTokenRevoked } from "../../utils/token-blacklist.js";

const mockIsTokenBlacklisted = vi.mocked(isTokenBlacklisted);
const mockIsUserTokenRevoked = vi.mocked(isUserTokenRevoked);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signToken(payload: Partial<JwtPayload> & { iat?: number }, opts: jwt.SignOptions = {}): string {
  const defaults: JwtPayload = {
    jti: "jti-default",
    userId: "user-001",
    email: "user@test.com",
    accountId: "account-001",
    role: "owner",
    isSystemAdmin: false,
  };
  return jwt.sign({ ...defaults, ...payload }, TEST_SECRET, { expiresIn: "15m", ...opts });
}

/** Build a Fastify app with the real auth middleware and mock DB. */
async function buildAuthApp(dbOverrides: {
  accountSelect?: any[];
  userSelect?: any[];
} = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Mock DB with chainable interface
  const mockDb: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      // Return based on what was passed — we use a simple approach:
      // The middleware calls db.select({id: users.id}).from(users).where(...)
      // and db.select({isSuspended: accounts.isSuspended}).from(accounts).where(...)
      // We determine which by checking the last from() call.
      return Promise.resolve(mockDb._nextResult ?? []);
    }),
  };

  // Track from() calls to decide which result to return
  let fromTarget: string | null = null;
  mockDb.from = vi.fn().mockImplementation((table: any) => {
    // drizzle table objects have a Symbol for the table name
    // We detect which table by checking the object's properties
    fromTarget = table;
    return {
      where: vi.fn().mockImplementation(() => {
        if (fromTarget && typeof fromTarget === "object") {
          // Check if it looks like accounts table
          const tableName = (fromTarget as any)?.[Symbol.for("drizzle:Name")] ?? "";
          if (tableName === "accounts") {
            return Promise.resolve(dbOverrides.accountSelect ?? []);
          }
          if (tableName === "users") {
            return Promise.resolve(dbOverrides.userSelect ?? [{ id: "user-001" }]);
          }
        }
        // Default: return user exists (for impersonation check)
        return Promise.resolve(dbOverrides.userSelect ?? [{ id: "user-001" }]);
      }),
    };
  });

  // Override select to always chain properly
  mockDb.select = vi.fn().mockImplementation(() => ({
    from: mockDb.from,
  }));

  app.decorate("db", mockDb);

  registerAuthMiddleware(app);

  // Echo route for testing protected endpoints
  app.get("/api/test", async (request) => ({
    user: request.user,
    isImpersonating: request.isImpersonating,
  }));

  // System admin route
  app.get("/api/system-admin/test", async (request) => ({
    ok: true,
    user: request.user,
  }));

  // Public routes
  app.get("/health", async () => ({ status: "ok" }));
  app.post("/api/auth/login", async () => ({ token: "fake" }));
  app.post("/api/auth/register", async () => ({ ok: true }));
  app.post("/api/auth/refresh", async () => ({ token: "fresh" }));
  app.get("/api/invitations/abc123", async () => ({ invite: true }));
  app.get("/api/public/apps", async () => ({ apps: [] }));
  app.get("/api/emails/unsubscribe", async () => ({ ok: true }));
  app.get("/metrics", async () => "metrics_data");

  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("registerAuthMiddleware — full integration", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
    mockIsTokenBlacklisted.mockReset();
    mockIsUserTokenRevoked.mockReset();
    mockIsTokenBlacklisted.mockResolvedValue(false);
    mockIsUserTokenRevoked.mockResolvedValue(false);
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  // -----------------------------------------------------------------------
  // Public path bypass
  // -----------------------------------------------------------------------

  describe("public paths bypass auth", () => {
    it("allows /health without auth", async () => {
      app = await buildAuthApp();
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: "ok" });
    });

    it("allows /metrics without auth", async () => {
      app = await buildAuthApp();
      const res = await app.inject({ method: "GET", url: "/metrics" });
      expect(res.statusCode).toBe(200);
    });

    it("allows /api/auth/login without auth", async () => {
      app = await buildAuthApp();
      const res = await app.inject({ method: "POST", url: "/api/auth/login" });
      expect(res.statusCode).toBe(200);
    });

    it("allows /api/auth/register without auth", async () => {
      app = await buildAuthApp();
      const res = await app.inject({ method: "POST", url: "/api/auth/register" });
      expect(res.statusCode).toBe(200);
    });

    it("allows /api/auth/refresh without auth", async () => {
      app = await buildAuthApp();
      const res = await app.inject({ method: "POST", url: "/api/auth/refresh" });
      expect(res.statusCode).toBe(200);
    });

    it("allows /api/invitations/* without auth", async () => {
      app = await buildAuthApp();
      const res = await app.inject({ method: "GET", url: "/api/invitations/abc123" });
      expect(res.statusCode).toBe(200);
    });

    it("allows /api/public/* without auth", async () => {
      app = await buildAuthApp();
      const res = await app.inject({ method: "GET", url: "/api/public/apps" });
      expect(res.statusCode).toBe(200);
    });

    it("allows /api/emails/* without auth", async () => {
      app = await buildAuthApp();
      const res = await app.inject({ method: "GET", url: "/api/emails/unsubscribe" });
      expect(res.statusCode).toBe(200);
    });

    it("allows OPTIONS requests without auth (CORS preflight)", async () => {
      app = await buildAuthApp();
      const res = await app.inject({ method: "OPTIONS", url: "/api/test" });
      expect(res.statusCode).not.toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // Missing / invalid auth header
  // -----------------------------------------------------------------------

  describe("missing or invalid auth header", () => {
    it("returns 401 when no Authorization header is provided", async () => {
      app = await buildAuthApp();
      const res = await app.inject({ method: "GET", url: "/api/test" });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("Unauthorized");
    });

    it("returns 401 when Authorization header lacks Bearer prefix", async () => {
      app = await buildAuthApp();
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: "Token abc123" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 when token is empty after Bearer", async () => {
      app = await buildAuthApp();
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: "Bearer " },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 for malformed JWT (not a valid JWT string)", async () => {
      app = await buildAuthApp();
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: "Bearer not.a.jwt" },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("Invalid or expired token");
    });

    it("returns 401 when token is signed with wrong secret", async () => {
      const wrongToken = jwt.sign(
        { userId: "u1", email: "a@b.com", accountId: "a1", role: "owner", isSystemAdmin: false },
        "wrong-secret",
        { expiresIn: "15m" },
      );
      app = await buildAuthApp();
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${wrongToken}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 when token is expired", async () => {
      const expiredToken = jwt.sign(
        { userId: "u1", email: "a@b.com", accountId: "a1", role: "owner", isSystemAdmin: false },
        TEST_SECRET,
        { expiresIn: "0s" },
      );
      app = await buildAuthApp();
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${expiredToken}` },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("Invalid or expired token");
    });
  });

  // -----------------------------------------------------------------------
  // Valid token — user population
  // -----------------------------------------------------------------------

  describe("valid token sets request.user", () => {
    it("populates request.user with JWT payload fields", async () => {
      app = await buildAuthApp();
      const token = signToken({
        userId: "user-42",
        email: "alice@example.com",
        accountId: "acc-99",
        role: "editor",
        isSystemAdmin: false,
      });
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.user.userId).toBe("user-42");
      expect(body.user.email).toBe("alice@example.com");
      expect(body.user.accountId).toBe("acc-99");
      expect(body.user.role).toBe("editor");
      expect(body.user.isSystemAdmin).toBe(false);
    });

    it("sets isSystemAdmin correctly for admin tokens", async () => {
      app = await buildAuthApp();
      const token = signToken({ isSystemAdmin: true });
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().user.isSystemAdmin).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Token blacklist (jti-based)
  // -----------------------------------------------------------------------

  describe("token blacklist (jti-based revocation)", () => {
    it("returns 401 when token jti is blacklisted", async () => {
      mockIsTokenBlacklisted.mockResolvedValue(true);
      app = await buildAuthApp();
      const token = signToken({ jti: "revoked-jti" });
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("Token has been revoked");
      expect(mockIsTokenBlacklisted).toHaveBeenCalledWith("revoked-jti");
    });

    it("allows request when token jti is not blacklisted", async () => {
      mockIsTokenBlacklisted.mockResolvedValue(false);
      app = await buildAuthApp();
      const token = signToken({ jti: "valid-jti" });
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(mockIsTokenBlacklisted).toHaveBeenCalledWith("valid-jti");
    });

    it("skips blacklist check when token has no jti", async () => {
      app = await buildAuthApp();
      // Sign token without jti
      const payload = {
        userId: "user-001",
        email: "user@test.com",
        accountId: "account-001",
        role: "owner" as const,
        isSystemAdmin: false,
      };
      const token = jwt.sign(payload, TEST_SECRET, { expiresIn: "15m" });
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(mockIsTokenBlacklisted).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // User-level token revocation (iat-based)
  // -----------------------------------------------------------------------

  describe("user-level token revocation (iat-based)", () => {
    it("returns 401 when all user sessions have been revoked", async () => {
      mockIsUserTokenRevoked.mockResolvedValue(true);
      app = await buildAuthApp();
      const token = signToken({ userId: "revoked-user" });
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("All sessions have been revoked");
    });

    it("allows request when user tokens are not revoked", async () => {
      mockIsUserTokenRevoked.mockResolvedValue(false);
      app = await buildAuthApp();
      const token = signToken({ userId: "active-user" });
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Impersonation
  // -----------------------------------------------------------------------

  describe("impersonation metadata", () => {
    it("sets isImpersonating=true when realAdmin is present", async () => {
      app = await buildAuthApp({ userSelect: [{ id: "user-001" }] });
      const token = signToken({
        realAdmin: { userId: "admin-001", email: "admin@test.com", accountId: "acc-admin" },
      });
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.isImpersonating).toBe(true);
      expect(body.user.realAdmin.userId).toBe("admin-001");
    });

    it("sets isImpersonating=false when realAdmin is absent", async () => {
      app = await buildAuthApp();
      const token = signToken({});
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().isImpersonating).toBe(false);
    });

    it("returns 403 when impersonated user no longer exists", async () => {
      app = await buildAuthApp({ userSelect: [] }); // empty = user not found
      const token = signToken({
        userId: "deleted-user",
        realAdmin: { userId: "admin-001", email: "admin@test.com", accountId: "acc-admin" },
      });
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("Impersonated user no longer exists");
    });
  });

  // -----------------------------------------------------------------------
  // System admin route protection
  // -----------------------------------------------------------------------

  describe("system-admin route protection", () => {
    it("returns 403 for non-admin accessing /api/system-admin/*", async () => {
      app = await buildAuthApp();
      const token = signToken({ isSystemAdmin: false });
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("Forbidden");
    });

    it("allows system admin to access /api/system-admin/*", async () => {
      app = await buildAuthApp();
      const token = signToken({ isSystemAdmin: true });
      const res = await app.inject({
        method: "GET",
        url: "/api/system-admin/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().ok).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Parallel Redis checks
  // -----------------------------------------------------------------------

  describe("parallel Redis blacklist + revocation checks", () => {
    it("calls both isTokenBlacklisted and isUserTokenRevoked in parallel", async () => {
      const callOrder: string[] = [];
      mockIsTokenBlacklisted.mockImplementation(async () => {
        callOrder.push("blacklist-start");
        await new Promise((r) => setTimeout(r, 10));
        callOrder.push("blacklist-end");
        return false;
      });
      mockIsUserTokenRevoked.mockImplementation(async () => {
        callOrder.push("revoked-start");
        await new Promise((r) => setTimeout(r, 10));
        callOrder.push("revoked-end");
        return false;
      });

      app = await buildAuthApp();
      const token = signToken({ jti: "parallel-test", userId: "u1" });
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      // Both should have started before either finished (parallel execution)
      expect(callOrder.indexOf("blacklist-start")).toBeLessThan(callOrder.indexOf("blacklist-end"));
      expect(callOrder.indexOf("revoked-start")).toBeLessThan(callOrder.indexOf("revoked-end"));
      // Both started before either ended — true parallelism
      const firstEnd = Math.min(callOrder.indexOf("blacklist-end"), callOrder.indexOf("revoked-end"));
      expect(callOrder.indexOf("blacklist-start")).toBeLessThan(firstEnd);
      expect(callOrder.indexOf("revoked-start")).toBeLessThan(firstEnd);
    });

    it("rejects with blacklisted even when revocation is false", async () => {
      mockIsTokenBlacklisted.mockResolvedValue(true);
      mockIsUserTokenRevoked.mockResolvedValue(false);
      app = await buildAuthApp();
      const token = signToken({ jti: "bl-jti" });
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("Token has been revoked");
    });

    it("rejects with revocation even when blacklist is false", async () => {
      mockIsTokenBlacklisted.mockResolvedValue(false);
      mockIsUserTokenRevoked.mockResolvedValue(true);
      app = await buildAuthApp();
      const token = signToken({ userId: "rev-user" });
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("All sessions have been revoked");
    });
  });

  // -----------------------------------------------------------------------
  // Account suspension
  // -----------------------------------------------------------------------

  describe("account suspension", () => {
    it("returns 403 when account is suspended for non-admin", async () => {
      app = await buildAuthApp({ accountSelect: [{ isSuspended: true }] });
      const token = signToken({ isSystemAdmin: false });
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("Account is suspended");
    });

    it("allows system admin even when account is suspended", async () => {
      app = await buildAuthApp({ accountSelect: [{ isSuspended: true }] });
      const token = signToken({ isSystemAdmin: true });
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it("allows request when account is not suspended", async () => {
      app = await buildAuthApp({ accountSelect: [{ isSuspended: false }] });
      const token = signToken({ isSystemAdmin: false });
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it("allows request when account is not found (non-critical check)", async () => {
      app = await buildAuthApp({ accountSelect: [] });
      const token = signToken({});
      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    });
  });
});

// ---------------------------------------------------------------------------
// getJwtSecret
// ---------------------------------------------------------------------------

describe("getJwtSecret", () => {
  it("returns the JWT_SECRET from environment", () => {
    process.env.JWT_SECRET = "my-secret";
    expect(getJwtSecret()).toBe("my-secret");
  });

  it("throws when JWT_SECRET is not set", () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecret()).toThrow("JWT_SECRET environment variable is required");
    process.env.JWT_SECRET = original;
  });
});
