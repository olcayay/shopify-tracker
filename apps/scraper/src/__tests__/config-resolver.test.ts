import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolveConfig, invalidateConfigCache, __TESTING__ } from "../config-resolver.js";

vi.mock("../platforms/registry.js", () => ({
  getPlatformConstants: vi.fn((platform: string) => {
    if (platform === "shopify") {
      return {
        rateLimit: { minDelayMs: 250, maxDelayMs: 1500 },
        httpMaxConcurrency: 6,
        appDetailsConcurrency: 8,
        appDetailsConcurrencyBulk: 2,
      };
    }
    return undefined;
  }),
}));

vi.mock("../constants.js", () => ({
  JOB_TIMEOUT_APP_DETAILS_MS: 30 * 60 * 1000,
  JOB_TIMEOUT_APP_DETAILS_ALL_MS: 6 * 60 * 60 * 1000,
  HTTP_MAX_CUMULATIVE_BACKOFF_MS: 90_000,
}));

describe("setPath (internal)", () => {
  const { setPath } = __TESTING__;

  it("sets flat keys at root", () => {
    const obj: Record<string, unknown> = {};
    setPath(obj, "appDetailsConcurrency", 5);
    expect(obj).toEqual({ appDetailsConcurrency: 5 });
  });

  it("sets dotted paths into nested objects", () => {
    const obj: Record<string, unknown> = {};
    setPath(obj, "rateLimit.minDelayMs", 500);
    expect(obj).toEqual({ rateLimit: { minDelayMs: 500 } });
  });

  it("preserves existing sibling values at nested level", () => {
    const obj: Record<string, unknown> = { rateLimit: { maxDelayMs: 1500 } };
    setPath(obj, "rateLimit.minDelayMs", 500);
    expect(obj).toEqual({ rateLimit: { minDelayMs: 500, maxDelayMs: 1500 } });
  });

  it("overwrites non-object intermediate values", () => {
    const obj: Record<string, unknown> = { rateLimit: 123 };
    setPath(obj, "rateLimit.minDelayMs", 500);
    expect(obj).toEqual({ rateLimit: { minDelayMs: 500 } });
  });
});

describe("buildCodeDefaults", () => {
  const { buildCodeDefaults } = __TESTING__;

  it("includes platform constants for a known platform", () => {
    const defaults = buildCodeDefaults("shopify" as any, "app_details");
    expect(defaults.rateLimit).toEqual({ minDelayMs: 250, maxDelayMs: 1500 });
    expect(defaults.appDetailsConcurrency).toBe(8);
    expect(defaults.appDetailsConcurrencyBulk).toBe(2);
  });

  it("pulls global-registered knobs into the default tree", () => {
    const defaults = buildCodeDefaults("shopify" as any, "app_details");
    expect(defaults.jobTimeoutMs).toBe(30 * 60 * 1000);
    expect(defaults.jobTimeoutAllMs).toBe(6 * 60 * 60 * 1000);
    expect(defaults.httpMaxCumulativeBackoffMs).toBe(90_000);
  });

  it("returns empty defaults for unknown platform", () => {
    const defaults = buildCodeDefaults("unknown" as any, "app_details");
    // Still has global-registered knobs
    expect(defaults.jobTimeoutMs).toBe(30 * 60 * 1000);
  });
});

describe("applyOverrides", () => {
  const { applyOverrides, buildCodeDefaults } = __TESTING__;

  it("returns base unchanged when overrides is empty", () => {
    const base = buildCodeDefaults("shopify" as any, "app_details");
    const out = applyOverrides(base, {}, "app_details");
    expect(out.appDetailsConcurrencyBulk).toBe(2);
  });

  it("applies a flat knob override", () => {
    const base = buildCodeDefaults("shopify" as any, "app_details");
    const out = applyOverrides(base, { appDetailsConcurrencyBulk: 4 }, "app_details");
    expect(out.appDetailsConcurrencyBulk).toBe(4);
    expect(out.appDetailsConcurrency).toBe(8); // unchanged
  });

  it("applies a dotted-path override", () => {
    const base = buildCodeDefaults("shopify" as any, "app_details");
    const out = applyOverrides(base, { "rateLimit.minDelayMs": 1000 }, "app_details");
    expect(out.rateLimit.minDelayMs).toBe(1000);
    expect(out.rateLimit.maxDelayMs).toBe(1500); // sibling preserved
  });

  it("ignores unknown keys (registry-gated)", () => {
    const base = buildCodeDefaults("shopify" as any, "app_details");
    const out = applyOverrides(base, { totallyUnknownKnob: 42 } as any, "app_details");
    expect((out as any).totallyUnknownKnob).toBeUndefined();
  });
});

function makeFakeDb(rows: unknown[], onQuery?: () => void) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            onQuery?.();
            return rows;
          },
        }),
      }),
    }),
  } as any;
}

describe("resolveConfig integration (no DB)", () => {
  beforeEach(() => {
    invalidateConfigCache();
  });

  it("falls back to code defaults when DB throws", async () => {
    const fakeDb = {
      select: () => { throw new Error("db down"); },
    } as any;
    const resolved = await resolveConfig(fakeDb, "shopify" as any, "app_details");
    expect(resolved.enabled).toBe(true);
    expect(resolved.overrides).toEqual({});
    expect(resolved.merged.appDetailsConcurrencyBulk).toBe(2);
  });

  it("applies DB overrides on top of defaults", async () => {
    const fakeDb = makeFakeDb([{ enabled: true, overrides: { appDetailsConcurrencyBulk: 5 } }]);
    const resolved = await resolveConfig(fakeDb, "shopify" as any, "app_details");
    expect(resolved.merged.appDetailsConcurrencyBulk).toBe(5);
    expect(resolved.defaults.appDetailsConcurrencyBulk).toBe(2); // defaults view unchanged
  });

  it("respects enabled=false", async () => {
    const fakeDb = makeFakeDb([{ enabled: false, overrides: {} }]);
    const resolved = await resolveConfig(fakeDb, "shopify" as any, "app_details");
    expect(resolved.enabled).toBe(false);
  });

  it("caches resolved result across calls", async () => {
    let callCount = 0;
    const fakeDb = makeFakeDb([{ enabled: true, overrides: {} }], () => { callCount++; });

    await resolveConfig(fakeDb, "shopify" as any, "app_details");
    await resolveConfig(fakeDb, "shopify" as any, "app_details");
    await resolveConfig(fakeDb, "shopify" as any, "app_details");

    expect(callCount).toBe(1);
    expect(__TESTING__.cacheSize()).toBeGreaterThan(0);
  });

  it("invalidateConfigCache() forces re-fetch", async () => {
    let callCount = 0;
    const fakeDb = makeFakeDb([{ enabled: true, overrides: {} }], () => { callCount++; });

    await resolveConfig(fakeDb, "shopify" as any, "app_details");
    invalidateConfigCache("shopify" as any, "app_details");
    await resolveConfig(fakeDb, "shopify" as any, "app_details");

    expect(callCount).toBe(2);
  });
});
