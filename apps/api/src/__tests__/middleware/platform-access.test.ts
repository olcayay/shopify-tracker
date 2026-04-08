/**
 * Tests for the platform access guard middleware.
 *
 * Uses a minimal Fastify app with mocked DB to verify:
 * - System admins bypass platform checks
 * - Globally enabled platforms allow access
 * - Disabled platforms return 403
 * - Requests without platform param pass through
 * - Skip paths are not checked
 * - Cache invalidation works
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../../middleware/auth.js";
import { registerPlatformAccessGuard, invalidatePlatformAccessCache } from "../../middleware/platform-access.js";

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

// Mock DB execute function
const mockExecute = vi.fn();

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Attach mock DB
  (app as any).db = { execute: mockExecute };

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

  // Register platform access guard
  registerPlatformAccessGuard(app);

  // Test route that accepts a platform query param
  app.get("/api/apps", async () => ({ ok: true }));
  app.get("/api/keywords", async () => ({ ok: true }));
  app.get("/api/categories", async () => ({ ok: true }));

  // Routes that should be skipped
  app.get("/api/auth/me", async () => ({ ok: true }));
  app.get("/api/system-admin/flags", async () => ({ ok: true }));
  app.get("/api/public/apps", async () => ({ ok: true }));

  await app.ready();
  return app;
}

describe("registerPlatformAccessGuard", () => {
  let app: FastifyInstance;
  const token = signToken({ isSystemAdmin: false });
  const adminToken = signToken({ isSystemAdmin: true });

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockExecute.mockReset();
    invalidatePlatformAccessCache();
  });

  it("passes through when no platform query param is present", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/apps",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("allows access when platform flag is globally enabled", async () => {
    mockExecute.mockResolvedValueOnce([{ allowed: true }]);

    const res = await app.inject({
      method: "GET",
      url: "/api/apps?platform=shopify",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when platform flag is disabled", async () => {
    mockExecute.mockResolvedValueOnce([{ allowed: false }]);

    const res = await app.inject({
      method: "GET",
      url: "/api/apps?platform=zendesk",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("PLATFORM_DISABLED");
    expect(res.json().platform).toBe("zendesk");
  });

  it("system admin bypasses platform check", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/apps?platform=zendesk",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("skips check for auth paths", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me?platform=shopify",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("skips check for system-admin paths", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/flags?platform=shopify",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("skips check for public paths", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/public/apps?platform=shopify",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("skips check for invalid platform IDs", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/apps?platform=invalid_platform",
      headers: { authorization: `Bearer ${token}` },
    });
    // Should pass through (invalid platform will be caught by route handler)
    expect(res.statusCode).toBe(200);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("caches results and reuses for subsequent requests", async () => {
    mockExecute.mockResolvedValueOnce([{ allowed: true }]);

    // First request — hits DB
    const res1 = await app.inject({
      method: "GET",
      url: "/api/apps?platform=shopify",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res1.statusCode).toBe(200);
    expect(mockExecute).toHaveBeenCalledTimes(1);

    // Second request — uses cache
    const res2 = await app.inject({
      method: "GET",
      url: "/api/keywords?platform=shopify",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res2.statusCode).toBe(200);
    expect(mockExecute).toHaveBeenCalledTimes(1); // still 1 — cache hit
  });

  it("cache invalidation forces re-check", async () => {
    mockExecute.mockResolvedValueOnce([{ allowed: true }]);

    // First request — cache miss
    await app.inject({
      method: "GET",
      url: "/api/apps?platform=salesforce",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(mockExecute).toHaveBeenCalledTimes(1);

    // Invalidate cache
    invalidatePlatformAccessCache("account-001");

    mockExecute.mockResolvedValueOnce([{ allowed: false }]);

    // Next request — cache miss, re-checks DB
    const res = await app.inject({
      method: "GET",
      url: "/api/apps?platform=salesforce",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("fails open when DB throws an error", async () => {
    mockExecute.mockRejectedValueOnce(new Error("DB down"));

    const res = await app.inject({
      method: "GET",
      url: "/api/apps?platform=wix",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200); // fail-open
  });

  it("fails open when flag does not exist (null result)", async () => {
    mockExecute.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: "GET",
      url: "/api/apps?platform=canva",
      headers: { authorization: `Bearer ${token}` },
    });
    // allowed defaults to true when result is empty
    expect(res.statusCode).toBe(200);
  });

  it("checks different platforms independently", async () => {
    mockExecute.mockResolvedValueOnce([{ allowed: true }]);
    mockExecute.mockResolvedValueOnce([{ allowed: false }]);

    const res1 = await app.inject({
      method: "GET",
      url: "/api/apps?platform=shopify",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res1.statusCode).toBe(200);

    const res2 = await app.inject({
      method: "GET",
      url: "/api/apps?platform=atlassian",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res2.statusCode).toBe(403);
  });
});
