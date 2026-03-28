import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import {
  requireIdempotencyKey,
  registerIdempotencyOnSend,
  _resetRedis,
} from "../../middleware/idempotency.js";

// In-memory mock Redis store
let store: Map<string, { value: string; ttl?: number }>;

function createMockRedis() {
  store = new Map();
  return {
    get: vi.fn(async (key: string) => store.get(key)?.value ?? null),
    set: vi.fn(async (key: string, value: string, _ex?: string, _ttl?: number) => {
      store.set(key, { value, ttl: _ttl });
      return "OK";
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
  } as any;
}

async function buildApp() {
  const app = Fastify();

  // Fake auth so request.user exists
  app.decorateRequest("user", null);
  app.decorateRequest("idempotencyCacheKey", undefined);
  app.addHook("onRequest", async (req) => {
    (req as any).user = { accountId: "acc-1", userId: "u1", role: "owner", isSystemAdmin: false, email: "test@test.com" };
  });

  registerIdempotencyOnSend(app);

  app.post(
    "/test",
    { preHandler: [requireIdempotencyKey()] },
    async (_req, reply) => {
      return reply.code(201).send({ id: "new-item", created: true });
    },
  );

  app.post(
    "/test-error",
    { preHandler: [requireIdempotencyKey()] },
    async (_req, reply) => {
      return reply.code(500).send({ error: "Something went wrong" });
    },
  );

  await app.ready();
  return app;
}

describe("idempotency middleware", () => {
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    _resetRedis(mockRedis);
  });

  it("passes through when no Idempotency-Key header is present", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/test", payload: {} });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toEqual({ id: "new-item", created: true });
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it("processes first request with idempotency key and caches response", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/test",
      payload: {},
      headers: { "idempotency-key": "key-1" },
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toEqual({ id: "new-item", created: true });

    // Should have set processing then cached the response
    expect(mockRedis.set).toHaveBeenCalledTimes(2);
    // First call: processing marker
    expect(mockRedis.set.mock.calls[0][1]).toBe("processing");
    // Second call: cached response
    const cachedEntry = JSON.parse(mockRedis.set.mock.calls[1][1]);
    expect(cachedEntry.statusCode).toBe(201);
  });

  it("replays cached response on duplicate request", async () => {
    const app = await buildApp();

    // First request
    await app.inject({
      method: "POST",
      url: "/test",
      payload: {},
      headers: { "idempotency-key": "key-2" },
    });

    // Second request with same key
    const res = await app.inject({
      method: "POST",
      url: "/test",
      payload: {},
      headers: { "idempotency-key": "key-2" },
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toEqual({ id: "new-item", created: true });
    expect(res.headers["x-idempotency-replayed"]).toBe("true");
  });

  it("returns 409 when same key is still processing", async () => {
    const app = await buildApp();

    // Manually set a processing marker
    store.set("idempotency:acc-1:key-3", { value: "processing" });

    const res = await app.inject({
      method: "POST",
      url: "/test",
      payload: {},
      headers: { "idempotency-key": "key-3" },
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error).toContain("already being processed");
  });

  it("rejects keys longer than 256 characters", async () => {
    const app = await buildApp();
    const longKey = "a".repeat(257);
    const res = await app.inject({
      method: "POST",
      url: "/test",
      payload: {},
      headers: { "idempotency-key": longKey },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toContain("too long");
  });

  it("removes processing marker on non-success response", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/test-error",
      payload: {},
      headers: { "idempotency-key": "key-err" },
    });

    expect(res.statusCode).toBe(500);
    // Should have deleted the processing marker
    expect(mockRedis.del).toHaveBeenCalledWith("idempotency:acc-1:key-err");
  });

  it("scopes keys by account ID", async () => {
    const app = await buildApp();

    await app.inject({
      method: "POST",
      url: "/test",
      payload: {},
      headers: { "idempotency-key": "shared-key" },
    });

    // The key should include the account ID
    expect(mockRedis.get).toHaveBeenCalledWith("idempotency:acc-1:shared-key");
  });

  it("proceeds without idempotency when Redis is unavailable", async () => {
    _resetRedis(null);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/test",
      payload: {},
      headers: { "idempotency-key": "key-no-redis" },
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toEqual({ id: "new-item", created: true });
  });
});
