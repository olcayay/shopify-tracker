/**
 * Tests for auth routes: register, login, refresh, logout, GET /me, PATCH /me.
 *
 * Uses buildTestApp with a mocked DB to test HTTP-level behavior via Fastify .inject().
 * Since the mock DB is simple (single selectResult/insertResult for all queries),
 * tests focus on input validation, auth headers, and response structure.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import {
  buildTestApp,
  adminToken,
  userToken,
  impersonationToken,
  authHeaders,
} from "../helpers/test-app.js";
import { authRoutes, loginLimiter, registerLimiter, passwordResetLimiter } from "../../routes/auth.js";
import type { FastifyInstance } from "fastify";

// Reset rate limiters before each test suite to avoid cross-test contamination
beforeEach(() => {
  loginLimiter.reset();
  registerLimiter.reset();
  passwordResetLimiter.reset();
});

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

describe("POST /api/auth/register — validation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        selectResult: [],
        insertResult: [
          {
            id: "new-item-001",
            name: "Test Co",
            email: "new@example.com",
            accountId: "new-item-001",
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

  it("returns 400 when email is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { password: "Password123", name: "Test", accountName: "Co" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
    expect(res.json().details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "email" })]),
    );
  });

  it("returns 400 when password is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "a@b.com", name: "Test", accountName: "Co" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
    expect(res.json().details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "password" })]),
    );
  });

  it("returns 400 when name is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "a@b.com", password: "Password123", accountName: "Co" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
    expect(res.json().details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "name" })]),
    );
  });

  it("returns 400 when accountName is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "a@b.com", password: "Password123", name: "Test" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
    expect(res.json().details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "accountName" })]),
    );
  });

  it("returns 400 when all required fields are missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when password is shorter than 8 characters", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "a@b.com", password: "short", name: "Test", accountName: "Co" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
    expect(res.json().details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "password", message: expect.stringMatching(/8 characters/i) }),
      ]),
    );
  });

  it("accepts exactly 8 character password with complexity (boundary)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "a@b.com", password: "Test1234", name: "Test", accountName: "Co" },
    });
    // Should not be a 400 for password validation
    expect(res.statusCode).not.toBe(400);
  });

  it("returns 400 when password has no uppercase letter", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "a@b.com", password: "test1234", name: "Test", accountName: "Co" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
    expect(res.json().details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "password", message: expect.stringMatching(/uppercase/i) }),
      ]),
    );
  });

  it("returns 400 when password has no number", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "a@b.com", password: "Testtest", name: "Test", accountName: "Co" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
    expect(res.json().details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "password", message: expect.stringMatching(/number/i) }),
      ]),
    );
  });
});

describe("POST /api/auth/register — email uniqueness", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        // select returns an existing user -> 409
        selectResult: [{ id: "existing-user-001" }],
        insertResult: [],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 409 when email already exists", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "taken@example.com",
        password: "Password123",
        name: "Test",
        accountName: "Co",
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/already/i);
  });
});

describe("POST /api/auth/register — successful registration", () => {
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
            email: "new@example.com",
            name: "New User",
            accountId: "new-user-001",
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

  it("returns accessToken and refreshToken on success", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "new@example.com",
        password: "Password123",
        name: "New User",
        accountName: "New Co",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeDefined();
    expect(typeof body.accessToken).toBe("string");
    expect(body.refreshToken).toBeDefined();
    expect(typeof body.refreshToken).toBe("string");
  });

  it("returns user object with expected fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "another@example.com",
        password: "Password123",
        name: "Another User",
        accountName: "Another Co",
      },
    });
    const body = res.json();
    expect(body.user).toBeDefined();
    expect(body.user.id).toBeDefined();
    expect(body.user.email).toBeDefined();
    expect(body.user.name).toBeDefined();
    expect(body.user.role).toBeDefined();
    expect(body.user.account).toBeDefined();
    expect(body.user.account.id).toBeDefined();
    expect(body.user.account.name).toBeDefined();
  });

  it("returns the user role as 'owner' for new registration", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "owner@example.com",
        password: "Password123",
        name: "Owner User",
        accountName: "Owner Co",
      },
    });
    const body = res.json();
    expect(body.user.role).toBe("owner");
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

describe("POST /api/auth/login — validation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        selectResult: [],
        insertResult: [],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 400 when email is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { password: "Password123" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
    expect(res.json().details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "email" })]),
    );
  });

  it("returns 400 when password is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@b.com" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
    expect(res.json().details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "password" })]),
    );
  });

  it("returns 400 when both fields are missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 401 when user is not found (empty select)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "missing@example.com", password: "Password123" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/invalid/i);
  });
});

describe("POST /api/auth/login — suspended account", () => {
  let app: FastifyInstance;
  const passwordHash = bcrypt.hashSync("Password123", 4);

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        // The mock returns the same row for user lookup and account lookup.
        // Include fields needed by both.
        selectResult: [
          {
            id: "user-suspended-001",
            email: "user@suspended.com",
            passwordHash,
            name: "Suspended User",
            role: "editor",
            isSystemAdmin: false,
            accountId: "account-suspended",
            isSuspended: true,
          },
        ],
        insertResult: [],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 403 for non-admin user on suspended account", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "user@suspended.com", password: "Password123" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatch(/suspended/i);
  });
});

describe("POST /api/auth/login — successful login", () => {
  let app: FastifyInstance;
  const passwordHash = bcrypt.hashSync("Correct123", 4);

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        selectResult: [
          {
            id: "user-001",
            email: "user@example.com",
            passwordHash,
            name: "Test User",
            role: "owner",
            isSystemAdmin: false,
            accountId: "account-001",
            isSuspended: false,
            company: "Test Corp",
          },
        ],
        insertResult: [],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns tokens and user data on valid credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "user@example.com", password: "Correct123" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeDefined();
    expect(typeof body.accessToken).toBe("string");
    expect(body.refreshToken).toBeDefined();
    expect(typeof body.refreshToken).toBe("string");
    expect(body.user).toBeDefined();
    expect(body.user.id).toBe("user-001");
    expect(body.user.email).toBe("user@example.com");
    expect(body.user.role).toBe("owner");
  });

  it("returns user account info in the response", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "user@example.com", password: "Correct123" },
    });
    const body = res.json();
    expect(body.user.account).toBeDefined();
    expect(body.user.account.id).toBeDefined();
  });

  it("returns 401 with wrong password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "user@example.com", password: "Wrong123" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/invalid/i);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/refresh
// ---------------------------------------------------------------------------

describe("POST /api/auth/refresh — validation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        selectResult: [],
        insertResult: [],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 400 when refreshToken is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
    expect(res.json().details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "refreshToken" })]),
    );
  });

  it("returns 401 when refresh token is not found in DB", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: { refreshToken: "nonexistent-token-hex-string" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/invalid/i);
  });
});

describe("POST /api/auth/refresh — expired token", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        selectResult: [
          {
            id: "rt-001",
            userId: "user-001",
            tokenHash: "some-hash",
            expiresAt: new Date(Date.now() - 86400000), // expired yesterday
          },
        ],
        insertResult: [],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 when refresh token is expired", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: { refreshToken: "expired-token-string" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/expired/i);
  });
});

describe("POST /api/auth/refresh — successful refresh", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        // First select: stored token (valid). Second select: user record.
        // Mock returns same row for both, so include all needed fields.
        selectResult: [
          {
            id: "rt-001",
            userId: "user-001",
            tokenHash: "some-hash",
            expiresAt: new Date(Date.now() + 86400000), // valid for 1 more day
            email: "user@example.com",
            name: "Test User",
            accountId: "account-001",
            role: "owner",
            isSystemAdmin: false,
          },
        ],
        insertResult: [],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns new accessToken and refreshToken on success", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: { refreshToken: "valid-refresh-token" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeDefined();
    expect(typeof body.accessToken).toBe("string");
    expect(body.refreshToken).toBeDefined();
    expect(typeof body.refreshToken).toBe("string");
    // New refresh token should differ from input
    expect(body.refreshToken).not.toBe("valid-refresh-token");
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

describe("POST /api/auth/logout", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {},
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 without a valid auth token (logout is a protected route)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      payload: { refreshToken: "some-token" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns success with a valid auth token and refresh token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: authHeaders(userToken()),
      payload: { refreshToken: "some-token" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().message).toMatch(/logged out/i);
  });

  it("returns 400 when refresh token is missing from body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: authHeaders(userToken()),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

describe("GET /api/auth/me — auth checks", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        selectResult: [
          {
            id: "user-001",
            email: "user@example.com",
            name: "Test User",
            role: "editor",
            isSystemAdmin: false,
            emailDigestEnabled: true,
            timezone: "Europe/Istanbul",
            accountId: "account-001",
            lastSeenAt: null,
            company: "Test Corp",
            isSuspended: false,
            maxTrackedApps: 10,
            maxTrackedKeywords: 50,
            maxCompetitorApps: 5,
            maxTrackedFeatures: 20,
            maxUsers: 5,
            maxResearchProjects: 3,
            maxPlatforms: 5,
            count: 3,
            platform: "shopify",
            overrideGlobalVisibility: false,
            isVisible: true,
          },
        ],
        insertResult: [],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 without auth header", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/unauthorized/i);
  });

  it("returns 401 with malformed auth header", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: "NotBearer sometoken" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 with invalid JWT", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: authHeaders("invalid.jwt.token"),
    });
    expect(res.statusCode).toBe(401);
  });
});

const meDbConfig = {
  selectResult: [
    {
      id: "user-001",
      email: "user@example.com",
      name: "Test User",
      role: "editor",
      isSystemAdmin: false,
      emailDigestEnabled: true,
      timezone: "Europe/Istanbul",
      accountId: "account-001",
      lastSeenAt: null,
      company: "Test Corp",
      isSuspended: false,
      maxTrackedApps: 10,
      maxTrackedKeywords: 50,
      maxCompetitorApps: 5,
      maxTrackedFeatures: 20,
      maxUsers: 5,
      maxResearchProjects: 3,
      maxPlatforms: 5,
      count: 3,
      platform: "shopify",
      overrideGlobalVisibility: false,
      isVisible: true,
    },
  ],
  executeResult: [
    {
      id: "account-001",
      name: "Test Account",
      company: "Test Corp",
      is_suspended: false,
      max_tracked_apps: 10,
      max_tracked_keywords: 50,
      max_competitor_apps: 5,
      max_tracked_features: 20,
      max_users: 5,
      max_research_projects: 3,
      max_platforms: 5,
      tracked_apps_count: 3,
      tracked_keywords_count: 3,
      competitor_apps_count: 3,
      tracked_features_count: 3,
      users_count: 3,
      research_projects_count: 3,
    },
  ],
  insertResult: [],
};

describe("GET /api/auth/me — response structure", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: meDbConfig,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns user and account data with valid token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user).toBeDefined();
    expect(body.user.id).toBe("user-001");
    expect(body.user.email).toBeDefined();
    expect(body.user.name).toBeDefined();
    expect(body.account).toBeDefined();
    expect(body.account.id).toBeDefined();
  });

  it("returns usage counts in account object", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: authHeaders(userToken()),
    });
    const body = res.json();
    expect(body.account.usage).toBeDefined();
    expect(body.account.limits).toBeDefined();
  });

  it("returns enabledPlatforms array", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: authHeaders(userToken()),
    });
    const body = res.json();
    expect(body.enabledPlatforms).toBeDefined();
    expect(Array.isArray(body.enabledPlatforms)).toBe(true);
  });

  it("returns enabledFeatures array", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: authHeaders(userToken()),
    });
    const body = res.json();
    expect(body.enabledFeatures).toBeDefined();
    expect(Array.isArray(body.enabledFeatures)).toBe(true);
  });

  it("returns user preferences (emailDigestEnabled, timezone)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: authHeaders(userToken()),
    });
    const body = res.json();
    expect(body.user.emailDigestEnabled).toBeDefined();
    expect(body.user.timezone).toBeDefined();
  });
});

describe("GET /api/auth/me — impersonation metadata", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        ...meDbConfig,
        selectResult: [
          {
            id: "user-001",
            email: "user@example.com",
            name: "Test User",
            role: "editor",
            isSystemAdmin: false,
            emailDigestEnabled: true,
            timezone: "UTC",
            accountId: "account-001",
            lastSeenAt: null,
            company: "Corp",
            isSuspended: false,
            maxTrackedApps: 10,
            maxTrackedKeywords: 50,
            maxCompetitorApps: 5,
            maxTrackedFeatures: 20,
            maxUsers: 5,
            maxResearchProjects: 3,
            maxPlatforms: 5,
            count: 0,
            platform: "shopify",
            overrideGlobalVisibility: false,
            isVisible: true,
          },
        ],
        insertResult: [],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("includes impersonation metadata when using impersonation token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: authHeaders(impersonationToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.impersonation).toBeDefined();
    expect(body.impersonation.isImpersonating).toBe(true);
    expect(body.impersonation.realAdmin).toBeDefined();
    expect(body.impersonation.realAdmin.userId).toBe("admin-001");
  });

  it("does not include impersonation metadata for normal token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: authHeaders(userToken()),
    });
    const body = res.json();
    expect(body.impersonation).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/auth/me
// ---------------------------------------------------------------------------

describe("PATCH /api/auth/me — auth and validation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        selectResult: [
          {
            id: "user-001",
            email: "user@example.com",
            name: "Test User",
            emailDigestEnabled: true,
            timezone: "Europe/Istanbul",
            passwordHash: bcrypt.hashSync("oldpassword", 4),
          },
        ],
        insertResult: [],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 without auth header", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      payload: { name: "Updated" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 when no valid fields are provided", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      headers: authHeaders(userToken()),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/no valid fields/i);
  });

  it("returns 400 when newPassword provided without currentPassword", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      headers: authHeaders(userToken()),
      payload: { newPassword: "Newpass123" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
    expect(res.json().details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "currentPassword", message: expect.stringMatching(/current password/i) }),
      ]),
    );
  });

  it("returns 400 when newPassword is shorter than 8 characters", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      headers: authHeaders(userToken()),
      payload: { newPassword: "short", currentPassword: "oldpassword" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
    expect(res.json().details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "newPassword", message: expect.stringMatching(/8 characters/i) }),
      ]),
    );
  });
});

describe("PATCH /api/auth/me — impersonation restrictions", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        selectResult: [
          {
            id: "user-001",
            email: "user@example.com",
            name: "Test User",
            emailDigestEnabled: true,
            timezone: "Europe/Istanbul",
            passwordHash: bcrypt.hashSync("oldpassword", 4),
          },
        ],
        insertResult: [],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("blocks password change during impersonation", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      headers: authHeaders(impersonationToken()),
      payload: { newPassword: "Newpass123", currentPassword: "oldpass123" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatch(/impersonat/i);
  });

  it("blocks email change during impersonation", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      headers: authHeaders(impersonationToken()),
      payload: { email: "newemail@example.com" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatch(/impersonat/i);
  });

  it("allows non-sensitive updates during impersonation", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      headers: authHeaders(impersonationToken()),
      payload: { name: "New Name" },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("PATCH /api/auth/me — successful updates", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        selectResult: [
          {
            id: "user-001",
            email: "user@example.com",
            name: "Test User",
            emailDigestEnabled: true,
            timezone: "Europe/Istanbul",
            passwordHash: bcrypt.hashSync("oldpassword", 4),
          },
        ],
        insertResult: [],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("allows name update with valid token", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      headers: authHeaders(userToken()),
      payload: { name: "Updated Name" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("allows timezone update with valid token", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      headers: authHeaders(userToken()),
      payload: { timezone: "America/New_York" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("allows emailDigestEnabled update with valid token", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      headers: authHeaders(userToken()),
      payload: { emailDigestEnabled: false },
    });
    expect(res.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------

describe("POST /api/auth/login — rate limiting", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: { selectResult: [], insertResult: [] },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 429 after too many login attempts from same IP", async () => {
    // The rate limiter is shared across the module, so we use unique IPs
    // by relying on Fastify inject which defaults to 127.0.0.1
    // Fire 5 allowed requests (they'll all fail with 400/401 but that's ok)
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: `user${i}@test.com`, password: "Password123" },
        remoteAddress: "10.0.0.99",
      });
    }

    // 6th request should be rate limited
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "another@test.com", password: "Password123" },
      remoteAddress: "10.0.0.99",
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toMatch(/too many/i);
    expect(res.headers["retry-after"]).toBeDefined();
  });

  it("does not rate limit different IPs", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "fresh@test.com", password: "Password123" },
      remoteAddress: "10.0.0.200",
    });
    // Should NOT be 429 — different IP
    expect(res.statusCode).not.toBe(429);
  });
});

describe("POST /api/auth/register — rate limiting", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: { selectResult: [], insertResult: [{ id: "acc-1", name: "Test" }] },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 429 after too many registration attempts from same IP", async () => {
    // Fire 3 allowed requests
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: `reg${i}@test.com`,
          password: "Password123",
          name: "Test",
          accountName: "Test Acc",
        },
        remoteAddress: "10.0.0.50",
      });
    }

    // 4th request should be rate limited
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "another@test.com",
        password: "Password123",
        name: "Test",
        accountName: "Test Acc",
      },
      remoteAddress: "10.0.0.50",
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toMatch(/too many/i);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password
// ---------------------------------------------------------------------------

describe("POST /api/auth/forgot-password", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        selectResult: [{ id: "user-001", name: "Test User", email: "test@example.com" }],
        insertResult: [{ id: "reset-001" }],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 400 when email is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
  });

  it("returns 400 when email is invalid", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: "not-an-email" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns success message for valid email (prevents enumeration)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: "test@example.com" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().message).toMatch(/if an account exists/i);
  });

  it("returns same success message for non-existent email", async () => {
    const nonExistentApp = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: { selectResult: [] },
    });
    const res = await nonExistentApp.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: "nobody@example.com" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().message).toMatch(/if an account exists/i);
    await nonExistentApp.close();
  });

  it("rate limits after 3 attempts", async () => {
    passwordResetLimiter.reset();
    const limitedApp = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: { selectResult: [] },
    });
    for (let i = 0; i < 3; i++) {
      await limitedApp.inject({
        method: "POST",
        url: "/api/auth/forgot-password",
        payload: { email: "test@example.com" },
        remoteAddress: "10.0.0.99",
      });
    }
    const res = await limitedApp.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: "test@example.com" },
      remoteAddress: "10.0.0.99",
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toMatch(/too many/i);
    await limitedApp.close();
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password
// ---------------------------------------------------------------------------

describe("POST /api/auth/reset-password", () => {
  it("returns 400 when token is missing", async () => {
    const app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: { selectResult: [] },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { password: "NewPassword123" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns 400 when password is missing", async () => {
    const app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: { selectResult: [] },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token: "some-token" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns 400 when password does not meet requirements", async () => {
    const app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: { selectResult: [] },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token: "some-token", password: "weak" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns 400 for invalid token", async () => {
    const app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: { selectResult: [] },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token: "invalid-token-123", password: "NewPassword123" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/invalid|expired/i);
    await app.close();
  });

  it("returns 400 for already used token", async () => {
    const app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        selectResult: [{
          id: "reset-001",
          userId: "user-001",
          tokenHash: "some-hash",
          expiresAt: new Date(Date.now() + 3600000),
          usedAt: new Date(), // already used
          createdAt: new Date(),
        }],
      },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token: "any-token-value", password: "NewPassword123" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/already been used/i);
    await app.close();
  });

  it("returns 400 for expired token", async () => {
    const app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        selectResult: [{
          id: "reset-001",
          userId: "user-001",
          tokenHash: "some-hash",
          expiresAt: new Date(Date.now() - 1000), // expired
          usedAt: null,
          createdAt: new Date(),
        }],
      },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token: "any-token-value", password: "NewPassword123" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/expired/i);
    await app.close();
  });

  it("returns success for valid token and password", async () => {
    const app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        selectResult: [{
          id: "reset-001",
          userId: "user-001",
          tokenHash: "some-hash",
          expiresAt: new Date(Date.now() + 3600000),
          usedAt: null,
          createdAt: new Date(),
        }],
      },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token: "valid-token-value", password: "NewPassword123" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().message).toMatch(/reset successfully/i);
    await app.close();
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/revoke-all-sessions
// ---------------------------------------------------------------------------

describe("POST /api/auth/revoke-all-sessions", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: { selectResult: [] },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 without auth token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/revoke-all-sessions",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns success with valid auth token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/revoke-all-sessions",
      headers: authHeaders(userToken({ role: "owner" })),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().message).toMatch(/revoked/i);
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/export — GDPR data export
// ---------------------------------------------------------------------------

describe("GET /api/auth/export", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: {
        selectResult: [{
          id: "user-001",
          email: "user@test.com",
          name: "Test User",
          role: "owner",
          accountId: "account-001",
          timezone: "UTC",
          emailDigestEnabled: true,
          isSystemAdmin: false,
          createdAt: new Date(),
          company: null,
          maxTrackedApps: 10,
        }],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 without auth token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/export",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns JSON export with content-disposition header", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/export",
      headers: authHeaders(userToken({ role: "owner" })),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-disposition"]).toContain("attachment");
    const body = res.json();
    expect(body.exportedAt).toBeDefined();
    expect(body.user).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/auth/me — account deletion
// ---------------------------------------------------------------------------

describe("DELETE /api/auth/me", () => {
  it("returns 401 without auth token", async () => {
    const app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: { selectResult: [] },
    });
    const res = await app.inject({
      method: "DELETE",
      url: "/api/auth/me",
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("returns 403 for non-owner users", async () => {
    const app = await buildTestApp({
      routes: authRoutes,
      prefix: "/api/auth",
      db: { selectResult: [] },
    });
    const res = await app.inject({
      method: "DELETE",
      url: "/api/auth/me",
      headers: authHeaders(userToken({ role: "editor" })),
      payload: { password: "Password123" },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
