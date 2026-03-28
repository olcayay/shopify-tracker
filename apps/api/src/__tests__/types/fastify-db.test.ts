/**
 * Tests that the Fastify type augmentation for `db` works correctly.
 * Verifies that app.db is accessible without `as any` casts.
 */
import { describe, it, expect, afterAll } from "vitest";
import { buildTestApp, userToken, authHeaders } from "../helpers/test-app.js";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";

describe("Fastify db type augmentation", () => {
  let app: FastifyInstance;

  const testRoutes: FastifyPluginAsync = async (instance) => {
    // Access db directly through typed instance — no `as any` needed
    const db = instance.db;

    instance.get("/typed-db", async () => {
      // Verify db is accessible and has expected Drizzle methods
      return {
        hasSelect: typeof db.select === "function",
        hasInsert: typeof db.insert === "function",
        hasUpdate: typeof db.update === "function",
        hasDelete: typeof db.delete === "function",
        hasExecute: typeof db.execute === "function",
      };
    });
  };

  afterAll(async () => {
    if (app) await app.close();
  });

  it("app.db is accessible with proper typing", async () => {
    app = await buildTestApp({
      routes: testRoutes,
      prefix: "/api/test",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/test/typed-db",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hasSelect).toBe(true);
    expect(body.hasInsert).toBe(true);
    expect(body.hasUpdate).toBe(true);
    expect(body.hasDelete).toBe(true);
    expect(body.hasExecute).toBe(true);
  });
});
