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

describe("Smoke Test API — history endpoint", () => {
  it("GET smoke-test/history returns 401 without token", async () => {
    const { systemAdminRoutes } = await import("../../routes/system-admin.js");
    const app = await buildTestApp({
      routes: systemAdminRoutes,
      prefix: "/api/system-admin",
      db: { executeResult: [] },
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/scraper/smoke-test/history",
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET smoke-test/history returns 403 for non-admin", async () => {
    const { systemAdminRoutes } = await import("../../routes/system-admin.js");
    const app = await buildTestApp({
      routes: systemAdminRoutes,
      prefix: "/api/system-admin",
      db: { executeResult: [] },
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/scraper/smoke-test/history",
      headers: authHeaders(userToken()),
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("GET smoke-test/history returns empty array when no data", async () => {
    const { systemAdminRoutes } = await import("../../routes/system-admin.js");
    const app = await buildTestApp({
      routes: systemAdminRoutes,
      prefix: "/api/system-admin",
      db: { executeResult: [] },
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/scraper/smoke-test/history",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
    await app.close();
  });

  it("GET smoke-test/history aggregates results correctly", async () => {
    const now = new Date();
    const mockRows = [
      { platform: "shopify", check_name: "categories", status: "pass", error: null, duration_ms: 1200, created_at: now },
      { platform: "shopify", check_name: "categories", status: "pass", error: null, duration_ms: 1100, created_at: new Date(now.getTime() - 60000) },
      { platform: "shopify", check_name: "categories", status: "fail", error: "timeout", duration_ms: 60000, created_at: new Date(now.getTime() - 120000) },
      { platform: "shopify", check_name: "app", status: "fail", error: "exit code 1", duration_ms: 5000, created_at: now },
    ];
    const { systemAdminRoutes } = await import("../../routes/system-admin.js");
    const app = await buildTestApp({
      routes: systemAdminRoutes,
      prefix: "/api/system-admin",
      db: { executeResult: mockRows },
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/scraper/smoke-test/history",
      headers: authHeaders(adminToken()),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);

    const catEntry = body.find((e: any) => e.checkName === "categories");
    expect(catEntry).toBeDefined();
    expect(catEntry.platform).toBe("shopify");
    expect(catEntry.passCount).toBe(2);
    expect(catEntry.totalCount).toBe(3);
    expect(catEntry.lastStatus).toBe("pass");
    expect(catEntry.recentErrors).toHaveLength(1);
    expect(catEntry.recentErrors[0].error).toBe("timeout");

    const appEntry = body.find((e: any) => e.checkName === "app");
    expect(appEntry).toBeDefined();
    expect(appEntry.passCount).toBe(0);
    expect(appEntry.totalCount).toBe(1);
    expect(appEntry.lastStatus).toBe("fail");
    expect(appEntry.recentErrors).toHaveLength(1);

    await app.close();
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

  it("filters by platform query param (row filter)", async () => {
    const { systemAdminRoutes } = await import("../../routes/system-admin.js");
    const { SMOKE_PLATFORMS } = await import("@appranks/shared");
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
        `${address}/api/system-admin/scraper/smoke-test?platform=shopify`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }
      );

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (let i = 0; i < 10; i++) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes("event: init")) break;
      }

      controller.abort();

      // Extract init event data
      const initMatch = buffer.match(/event: init\ndata: (.+)\n/);
      expect(initMatch).toBeTruthy();
      const initData = JSON.parse(initMatch![1]);

      // Should only include shopify checks
      const shopifyPlatform = SMOKE_PLATFORMS.find((p) => p.platform === "shopify");
      expect(initData.totalChecks).toBe(shopifyPlatform!.checks.length);
      expect(initData.filterPlatform).toBe("shopify");
    } finally {
      await app.close();
    }
  }, 15_000);

  it("filters by check query param (column filter)", async () => {
    const { systemAdminRoutes } = await import("../../routes/system-admin.js");
    const { SMOKE_PLATFORMS } = await import("@appranks/shared");
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
        `${address}/api/system-admin/scraper/smoke-test?check=categories`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }
      );

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (let i = 0; i < 10; i++) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes("event: init")) break;
      }

      controller.abort();

      const initMatch = buffer.match(/event: init\ndata: (.+)\n/);
      expect(initMatch).toBeTruthy();
      const initData = JSON.parse(initMatch![1]);

      // All platforms have categories, so count should match platform count
      const platformsWithCategories = SMOKE_PLATFORMS.filter((p) =>
        p.checks.some((c) => c.check === "categories")
      );
      expect(initData.totalChecks).toBe(platformsWithCategories.length);
      expect(initData.filterCheck).toBe("categories");
    } finally {
      await app.close();
    }
  }, 15_000);

  it("filters by both platform and check (cell filter)", async () => {
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
        `${address}/api/system-admin/scraper/smoke-test?platform=shopify&check=categories`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }
      );

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (let i = 0; i < 10; i++) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes("event: init")) break;
      }

      controller.abort();

      const initMatch = buffer.match(/event: init\ndata: (.+)\n/);
      expect(initMatch).toBeTruthy();
      const initData = JSON.parse(initMatch![1]);

      // Single cell: exactly 1 check
      expect(initData.totalChecks).toBe(1);
      expect(initData.filterPlatform).toBe("shopify");
      expect(initData.filterCheck).toBe("categories");
    } finally {
      await app.close();
    }
  }, 15_000);

  it("returns 0 checks for N/A cell filter", async () => {
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

      // salesforce has no "featured" check
      const response = await fetch(
        `${address}/api/system-admin/scraper/smoke-test?platform=salesforce&check=featured`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }
      );

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (let i = 0; i < 10; i++) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes("event: init")) break;
      }

      controller.abort();

      const initMatch = buffer.match(/event: init\ndata: (.+)\n/);
      expect(initMatch).toBeTruthy();
      const initData = JSON.parse(initMatch![1]);
      expect(initData.totalChecks).toBe(0);
    } finally {
      await app.close();
    }
  }, 15_000);
});
