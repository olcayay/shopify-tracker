import { describe, it, expect, vi } from "vitest";
import { assertRedisNoEviction } from "../redis-policy-check.js";

function makeLog() {
  return { info: vi.fn(), error: vi.fn() };
}

describe("assertRedisNoEviction (PLA-1053)", () => {
  it("returns ok when policy is noeviction (array form)", async () => {
    const client = { config: vi.fn(async () => ["maxmemory-policy", "noeviction"]) };
    const log = makeLog();
    const capture = vi.fn();

    const result = await assertRedisNoEviction(client, log, capture);

    expect(result).toEqual({ policy: "noeviction", ok: true });
    expect(log.info).toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it("returns ok when policy is noeviction (string form)", async () => {
    const client = { config: vi.fn(async () => "noeviction") };
    const log = makeLog();
    const result = await assertRedisNoEviction(client, log);
    expect(result.ok).toBe(true);
  });

  it("logs error + Sentry when policy is volatile-lru (the observed prod misconfig)", async () => {
    const client = { config: vi.fn(async () => ["maxmemory-policy", "volatile-lru"]) };
    const log = makeLog();
    const capture = vi.fn();

    const result = await assertRedisNoEviction(client, log, capture);

    expect(result).toEqual({ policy: "volatile-lru", ok: false });
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("noeviction"),
      expect.objectContaining({ policy: "volatile-lru" }),
    );
    expect(capture).toHaveBeenCalledWith(
      expect.stringContaining("volatile-lru"),
      "error",
    );
  });

  it("also flags allkeys-lru / volatile-ttl / etc", async () => {
    for (const policy of ["allkeys-lru", "allkeys-lfu", "volatile-ttl", "volatile-lfu"]) {
      const client = { config: vi.fn(async () => ["maxmemory-policy", policy]) };
      const log = makeLog();
      const result = await assertRedisNoEviction(client, log);
      expect(result.ok).toBe(false);
      expect(result.policy).toBe(policy);
    }
  });

  it("handles CONFIG GET errors gracefully (returns ok=false, does not throw)", async () => {
    const client = {
      config: vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    };
    const log = makeLog();
    const result = await assertRedisNoEviction(client, log);

    expect(result.ok).toBe(false);
    expect(result.policy).toBe("unknown");
    expect(log.error).toHaveBeenCalledWith(
      "failed to read Redis maxmemory-policy",
      expect.objectContaining({ error: "ECONNREFUSED" }),
    );
  });

  it("does not require a Sentry capture callback", async () => {
    const client = { config: vi.fn(async () => ["maxmemory-policy", "volatile-lru"]) };
    const log = makeLog();
    await expect(assertRedisNoEviction(client, log)).resolves.toEqual({
      policy: "volatile-lru",
      ok: false,
    });
  });
});
