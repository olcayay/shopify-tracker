import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { createMockDb } from "../helpers/test-app.js";
import { waitlistRoutes, waitlistAdminRoutes, waitlistLimiter } from "../../routes/waitlist.js";

// ---------------------------------------------------------------------------
// Helper: build a minimal Fastify app for waitlist routes
// ---------------------------------------------------------------------------
async function buildWaitlistApp(dbOverrides?: any): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const mockDb = createMockDb(dbOverrides);
  app.decorate("db", mockDb);
  await app.register(
    async (instance) => {
      instance.db = mockDb;
      await waitlistRoutes(instance);
    },
    { prefix: "/api/public" },
  );
  await app.ready();
  return app;
}

async function buildAdminApp(dbOverrides?: any): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const mockDb = createMockDb(dbOverrides);
  app.decorate("db", mockDb);
  await app.register(
    async (instance) => {
      instance.db = mockDb;
      await waitlistAdminRoutes(instance);
    },
    { prefix: "/api/system-admin" },
  );
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Public waitlist endpoint
// ---------------------------------------------------------------------------
describe("POST /api/public/waitlist", () => {
  beforeEach(() => {
    waitlistLimiter.reset();
  });

  it("accepts a valid email and returns success", async () => {
    const app = await buildWaitlistApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/public/waitlist",
      payload: { email: "test@example.com" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toContain("waitlist");
  });

  it("normalizes email to lowercase", async () => {
    let capturedEmail: string | undefined;
    const app = Fastify({ logger: false });
    const mockDb = createMockDb();
    // Override insert to capture the email
    const originalInsert = mockDb.insert;
    mockDb.insert = (...args: any[]) => {
      const chain = originalInsert(...args);
      const originalValues = chain.values;
      chain.values = (vals: any) => {
        capturedEmail = vals.email;
        return originalValues(vals);
      };
      return chain;
    };
    app.decorate("db", mockDb);
    await app.register(
      async (instance) => {
        instance.db = mockDb;
        await waitlistRoutes(instance);
      },
      { prefix: "/api/public" },
    );
    await app.ready();

    await app.inject({
      method: "POST",
      url: "/api/public/waitlist",
      payload: { email: "Test@Example.COM" },
    });
    expect(capturedEmail).toBe("test@example.com");
  });

  it("rejects invalid email with 400", async () => {
    const app = await buildWaitlistApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/public/waitlist",
      payload: { email: "not-an-email" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects missing email with 400", async () => {
    const app = await buildWaitlistApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/public/waitlist",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects disposable email with 400", async () => {
    const app = await buildWaitlistApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/public/waitlist",
      payload: { email: "test@mailinator.com" },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toContain("permanent");
  });

  it("rate limits after 5 attempts", async () => {
    const app = await buildWaitlistApp();
    // Send 5 requests (all allowed)
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/public/waitlist",
        payload: { email: `user${i}@example.com` },
      });
      expect(res.statusCode).toBe(200);
    }
    // 6th should be rate limited
    const res = await app.inject({
      method: "POST",
      url: "/api/public/waitlist",
      payload: { email: "user6@example.com" },
    });
    expect(res.statusCode).toBe(429);
  });

  it("returns success even if email already exists (no enumeration)", async () => {
    // DB insert will throw on duplicate — but we swallow it
    const app = Fastify({ logger: false });
    const mockDb = createMockDb();
    const originalInsert = mockDb.insert;
    mockDb.insert = (...args: any[]) => {
      const chain = originalInsert(...args);
      const originalOnConflict = chain.onConflictDoNothing;
      chain.onConflictDoNothing = (...a: any[]) => {
        // Simulate that the insert was a no-op due to conflict
        return originalOnConflict(...a);
      };
      return chain;
    };
    app.decorate("db", mockDb);
    await app.register(
      async (instance) => {
        instance.db = mockDb;
        await waitlistRoutes(instance);
      },
      { prefix: "/api/public" },
    );
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/api/public/waitlist",
      payload: { email: "duplicate@example.com" },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Admin waitlist endpoints
// ---------------------------------------------------------------------------
describe("GET /api/system-admin/waitlist", () => {
  it("returns empty array when no entries", async () => {
    const app = await buildAdminApp({ selectResult: [] });
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/waitlist",
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  it("returns waitlist entries", async () => {
    const entries = [
      {
        id: "uuid-1",
        email: "alice@example.com",
        ipAddress: "1.2.3.4",
        userAgent: "Mozilla/5.0",
        referrer: "https://google.com",
        notes: null,
        createdAt: new Date("2026-04-01"),
      },
    ];
    const app = await buildAdminApp({ selectResult: entries });
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/waitlist",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(1);
    expect(body[0].email).toBe("alice@example.com");
  });
});

describe("GET /api/system-admin/waitlist/count", () => {
  it("returns count", async () => {
    const app = await buildAdminApp({ selectResult: [{ count: 42 }] });
    const res = await app.inject({
      method: "GET",
      url: "/api/system-admin/waitlist/count",
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).count).toBe(42);
  });
});

describe("DELETE /api/system-admin/waitlist/:id", () => {
  it("returns 404 when entry not found (empty returning)", async () => {
    // Default mock delete returns [] → triggers 404
    const app = await buildAdminApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/system-admin/waitlist/non-existent",
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error).toBe("Entry not found");
  });

  it("deletes an entry and returns success", async () => {
    const app = Fastify({ logger: false });
    const mockDb = createMockDb();
    // Make delete chain resolve to a row (simulating successful delete)
    mockDb.delete = () => {
      const deleteChain: any = {};
      deleteChain.where = () => deleteChain;
      deleteChain.returning = () => deleteChain;
      deleteChain.then = (resolve: any, reject?: any) =>
        Promise.resolve([{ id: "uuid-1" }]).then(resolve, reject);
      return deleteChain;
    };
    app.decorate("db", mockDb);
    await app.register(
      async (instance) => {
        instance.db = mockDb;
        await waitlistAdminRoutes(instance);
      },
      { prefix: "/api/system-admin" },
    );
    await app.ready();

    const res = await app.inject({
      method: "DELETE",
      url: "/api/system-admin/waitlist/uuid-1",
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).success).toBe(true);
  });
});
