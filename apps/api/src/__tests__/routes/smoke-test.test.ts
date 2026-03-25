import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  adminToken,
  userToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";

describe("Smoke Test API — auth & validation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { systemAdminRoutes } = await import("../../routes/system-admin.js");
    app = await buildTestApp({
      routes: systemAdminRoutes,
      prefix: "/api/system-admin",
      db: { executeResult: [] },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ── SSE endpoint auth ──────────────────────────────────────────

  it("GET smoke-test returns 401 without token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/scraper/smoke-test",
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET smoke-test returns 403 for non-admin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/scraper/smoke-test",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(403);
  });

  // ── Retry endpoint auth & validation ───────────────────────────

  it("POST smoke-test/check returns 401 without token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/scraper/smoke-test/check",
      payload: { platform: "shopify", check: "categories" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST smoke-test/check returns 403 for non-admin", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/scraper/smoke-test/check",
      headers: authHeaders(userToken()),
      payload: { platform: "shopify", check: "categories" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("POST smoke-test/check returns 400 for missing platform", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/scraper/smoke-test/check",
      headers: authHeaders(adminToken()),
      payload: { check: "categories" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST smoke-test/check returns 400 for missing check", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/scraper/smoke-test/check",
      headers: authHeaders(adminToken()),
      payload: { platform: "shopify" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST smoke-test/check returns 400 for unknown platform", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/scraper/smoke-test/check",
      headers: authHeaders(adminToken()),
      payload: { platform: "nonexistent", check: "categories" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("Unknown platform");
  });

  it("POST smoke-test/check returns 400 for N/A check", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/system-admin/scraper/smoke-test/check",
      headers: authHeaders(adminToken()),
      payload: { platform: "salesforce", check: "featured" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("N/A");
  });
});

describe("Smoke Test API — SSE streaming", () => {
  it("streams SSE events with init event for admin", async () => {
    const { systemAdminRoutes } = await import("../../routes/system-admin.js");
    const app = await buildTestApp({
      routes: systemAdminRoutes,
      prefix: "/api/system-admin",
      db: { executeResult: [] },
    });

    const address = await app.listen({ port: 0, host: "127.0.0.1" });
    try {
      const controller = new AbortController();
      const token = adminToken();

      const response = await fetch(
        `${address}/api/system-admin/scraper/smoke-test`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/event-stream");

      // Read just enough to verify the init event, then abort
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (let i = 0; i < 10; i++) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes("event: init") && buffer.includes("totalChecks")) {
          break;
        }
      }

      controller.abort();
      expect(buffer).toContain("event: init");
      expect(buffer).toContain("totalChecks");
    } finally {
      await app.close();
    }
  }, 15_000);
});
