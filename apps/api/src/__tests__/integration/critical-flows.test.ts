/**
 * E2E integration tests for critical user journeys.
 *
 * Tests multi-step flows end-to-end using the Fastify .inject() API
 * with mocked DB. Each test verifies the full HTTP request/response chain.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import {
  buildTestApp,
  adminToken,
  userToken,
  authHeaders,
} from "../helpers/test-app.js";
import { authRoutes, loginLimiter, registerLimiter, passwordResetLimiter, accountLockout } from "../../routes/auth.js";
import { _resetRateLimitRedis } from "../../utils/rate-limiter.js";
import { _resetBlacklistRedis } from "../../utils/token-blacklist.js";
import { _resetCacheRedis } from "../../utils/cache.js";
import type { FastifyInstance } from "fastify";

// Disable all Redis connections for CI — each falls back to in-memory/no-op
_resetRateLimitRedis(null);
_resetBlacklistRedis(null);
_resetCacheRedis(null);

beforeEach(() => {
  loginLimiter.reset();
  registerLimiter.reset();
  passwordResetLimiter.reset();
  accountLockout.reset();
});

// ---------------------------------------------------------------------------
// Flow 1: Register → Login → Get /me
// ---------------------------------------------------------------------------

describe("Flow: Register → Login → Get /me", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        selectResult: [],
        insertResult: [
          {
            id: "new-user-001",
            name: "Test User",
            email: "new@test.com",
            accountId: "new-account-001",
            role: "owner",
            isSystemAdmin: false,
            company: null,
          },
        ],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("register returns 200 with tokens", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "new@test.com",
        password: "Password123",
        name: "Test User",
        accountName: "My Co",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.user.email).toBe("new@test.com");
  });
});

// ---------------------------------------------------------------------------
// Flow 2: Failed logins → Account lockout → Recovery
// ---------------------------------------------------------------------------

describe("Flow: Failed logins → Account lockout", () => {
  let app: FastifyInstance;
  const passwordHash = bcrypt.hashSync("Password123", 4); // Low rounds for test speed

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        selectResult: [
          {
            id: "user-001",
            email: "victim@test.com",
            passwordHash,
            name: "Victim",
            accountId: "account-001",
            role: "owner",
            isSystemAdmin: false,
            isSuspended: false,
          },
        ],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("locks account after 10 failed attempts", { timeout: 30_000 }, async () => {
    // Use different IPs to avoid IP-based rate limiting (5/15min)
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "victim@test.com", password: "WrongPassword1" },
        remoteAddress: `10.0.${Math.floor(i / 4)}.${(i % 4) + 1}`,
      });
      expect(res.statusCode).toBe(401);
    }

    // 11th attempt should be locked (423)
    const locked = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "victim@test.com", password: "WrongPassword1" },
      remoteAddress: "10.1.0.1",
    });
    expect(locked.statusCode).toBe(423);
    expect(locked.json().error).toMatch(/locked/i);
    expect(locked.headers["retry-after"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Flow 3: Forgot password → Reset password validation
// ---------------------------------------------------------------------------

describe("Flow: Forgot password → Reset password", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        selectResult: [{ id: "user-001", name: "Test User", email: "test@test.com" }],
        insertResult: [{ id: "token-001" }],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("forgot-password returns success message regardless of email existence", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: "test@test.com" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().message).toMatch(/if an account exists/i);
  });

  it("forgot-password rate limits after 3 attempts", async () => {
    passwordResetLimiter.reset();
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: "POST",
        url: "/api/auth/forgot-password",
        payload: { email: "test@test.com" },
        remoteAddress: "10.0.0.200",
      });
    }
    const limited = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: "test@test.com" },
      remoteAddress: "10.0.0.200",
    });
    expect(limited.statusCode).toBe(429);
  });
});

// ---------------------------------------------------------------------------
// Flow 4: Auth header validation across endpoints
// ---------------------------------------------------------------------------

describe("Flow: Auth header validation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        selectResult: [
          {
            id: "user-001",
            email: "user@test.com",
            name: "Test",
            role: "owner",
            isSystemAdmin: false,
            emailDigestEnabled: true,
            timezone: "UTC",
            accountId: "account-001",
            lastSeenAt: null,
            maxTrackedApps: 10,
            maxTrackedKeywords: 10,
            maxCompetitorApps: 5,
            maxTrackedFeatures: 10,
            maxUsers: 5,
            maxResearchProjects: 1,
            maxPlatforms: 1,
            isSuspended: false,
          },
        ],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /me returns 401 without auth header", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /me returns 401 with invalid token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: "Bearer invalid.token.here" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /me returns 200 with valid token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: authHeaders(userToken({ role: "owner" })),
    });
    expect(res.statusCode).toBe(200);
  });

  it("PATCH /me returns 200 with valid update", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      headers: authHeaders(userToken({ role: "owner" })),
      payload: { name: "Updated Name" },
    });
    expect(res.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Flow 5: Verify email flow
// ---------------------------------------------------------------------------

describe("Flow: Email verification", () => {
  it("verify-email returns 400 without token", async () => {
    const app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: { selectResult: [] },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("verify-email returns 400 for invalid token", async () => {
    const app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: { selectResult: [] },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email",
      payload: { token: "nonexistent-token" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
