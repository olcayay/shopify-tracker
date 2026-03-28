import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isCircuitOpen,
  recordSuccess,
  recordFailure,
  getCircuitState,
  overrideCircuit,
  _resetCircuitRedis,
} from "../circuit-breaker.js";

let store: Map<string, string>;

function createMockRedis() {
  store = new Map();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, _ex?: string, _ttl?: number) => {
      store.set(key, value);
      return "OK";
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    quit: vi.fn(async () => {}),
  } as any;
}

describe("circuit breaker", () => {
  beforeEach(() => {
    _resetCircuitRedis(createMockRedis());
  });

  it("circuit is closed by default", async () => {
    expect(await isCircuitOpen("shopify")).toBe(false);
  });

  it("circuit stays closed after fewer than threshold failures", async () => {
    await recordFailure("shopify");
    await recordFailure("shopify");
    await recordFailure("shopify");
    expect(await isCircuitOpen("shopify")).toBe(false);
  });

  it("circuit opens after threshold failures (5)", async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailure("shopify");
    }
    expect(await isCircuitOpen("shopify")).toBe(true);
  });

  it("circuit resets on success", async () => {
    await recordFailure("shopify");
    await recordFailure("shopify");
    await recordSuccess("shopify");

    const state = await getCircuitState("shopify");
    expect(state.failures).toBe(0);
    expect(state.state).toBe("closed");
  });

  it("half-open circuit closes on success", async () => {
    // Force open
    await overrideCircuit("shopify", "half-open");
    expect(await isCircuitOpen("shopify")).toBe(false); // half-open allows

    await recordSuccess("shopify");
    const state = await getCircuitState("shopify");
    expect(state.state).toBe("closed");
  });

  it("half-open circuit re-opens on failure", async () => {
    await overrideCircuit("shopify", "half-open");
    await recordFailure("shopify");

    const state = await getCircuitState("shopify");
    expect(state.state).toBe("open");
  });

  it("admin can override circuit state", async () => {
    await overrideCircuit("salesforce", "open");
    expect(await isCircuitOpen("salesforce")).toBe(true);

    await overrideCircuit("salesforce", "closed");
    expect(await isCircuitOpen("salesforce")).toBe(false);
  });

  it("circuits are scoped per platform", async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailure("zendesk");
    }
    expect(await isCircuitOpen("zendesk")).toBe(true);
    expect(await isCircuitOpen("shopify")).toBe(false);
  });

  it("degrades gracefully when Redis is unavailable", async () => {
    _resetCircuitRedis(null);
    expect(await isCircuitOpen("shopify")).toBe(false); // fail-open
    await recordFailure("shopify"); // no-op
    await recordSuccess("shopify"); // no-op
  });
});
