import { describe, it, expect, beforeEach, vi } from "vitest";
import { getCategoryTotalsForPlatform } from "../../utils/category-totals.js";
import { _resetCacheRedis } from "../../utils/cache.js";

describe("getCategoryTotalsForPlatform (PLA-1063)", () => {
  beforeEach(() => {
    _resetCacheRedis(null);
  });

  it("queries app_category_rankings ONCE per call when no cache", async () => {
    const exec = vi.fn(async () => ({
      rows: [
        { category_slug: "marketing", total_apps: 120 },
        { category_slug: "sales", total_apps: 80 },
      ],
    }));
    const db = { execute: exec } as any;

    const out = await getCategoryTotalsForPlatform(db, "shopify");
    expect(out).toEqual({ marketing: 120, sales: 80 });
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it("returns an empty record when the table has no rows for the platform", async () => {
    const exec = vi.fn(async () => ({ rows: [] }));
    const db = { execute: exec } as any;
    const out = await getCategoryTotalsForPlatform(db, "ghost-platform");
    expect(out).toEqual({});
  });

  it("coerces total_apps to a number; null/undefined becomes 0", async () => {
    const exec = vi.fn(async () => ({
      rows: [
        { category_slug: "x", total_apps: "42" },
        { category_slug: "y", total_apps: null },
      ],
    }));
    const db = { execute: exec } as any;
    const out = await getCategoryTotalsForPlatform(db, "shopify");
    expect(out.x).toBe(42);
    expect(out.y).toBe(0);
  });

  it("handles raw array result (no .rows wrapper)", async () => {
    const exec = vi.fn(async () => [
      { category_slug: "m", total_apps: 7 },
    ]);
    const db = { execute: exec } as any;
    const out = await getCategoryTotalsForPlatform(db, "atlassian");
    expect(out.m).toBe(7);
  });
});
