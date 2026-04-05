import { describe, it, expect } from "vitest";
import {
  SMOKE_PLATFORMS,
  SMOKE_CHECKS,
  BROWSER_PLATFORMS,
  getSmokeCheck,
  getSmokePlatform,
  countTotalSmokeChecks,
} from "../constants/smoke-test.js";
import { PLATFORM_IDS } from "../constants/platforms.js";

describe("SMOKE_PLATFORMS", () => {
  it("covers all 11 platforms", () => {
    const platforms = SMOKE_PLATFORMS.map((p) => p.platform);
    expect(platforms).toHaveLength(11);
    for (const id of PLATFORM_IDS) {
      expect(platforms).toContain(id);
    }
  });

  it("each platform has at least categories, app, and keyword checks", () => {
    for (const sp of SMOKE_PLATFORMS) {
      const checkNames = sp.checks.map((c) => c.check);
      expect(checkNames).toContain("categories");
      expect(checkNames).toContain("app");
      expect(checkNames).toContain("keyword");
    }
  });

  it("each platform has a valid clientType", () => {
    for (const sp of SMOKE_PLATFORMS) {
      expect(["http", "browser"]).toContain(sp.clientType);
    }
  });

  it("http platforms have 60s timeout, browser platforms have 120s timeout", () => {
    for (const sp of SMOKE_PLATFORMS) {
      if (sp.clientType === "http") {
        expect(sp.timeoutSec).toBe(60);
      } else {
        expect(sp.timeoutSec).toBe(120);
      }
    }
  });

  it("each check has a valid check name", () => {
    for (const sp of SMOKE_PLATFORMS) {
      for (const c of sp.checks) {
        expect(SMOKE_CHECKS).toContain(c.check);
      }
    }
  });

  it("all checks with args have non-empty args", () => {
    for (const sp of SMOKE_PLATFORMS) {
      for (const c of sp.checks) {
        if (c.arg !== undefined) {
          expect(c.arg.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("SMOKE_CHECKS", () => {
  it("has exactly 5 check types", () => {
    expect(SMOKE_CHECKS).toHaveLength(5);
    expect(SMOKE_CHECKS).toEqual([
      "categories",
      "app",
      "keyword",
      "reviews",
      "featured",
    ]);
  });
});

describe("BROWSER_PLATFORMS", () => {
  it("lists only browser-type platforms", () => {
    const expected = SMOKE_PLATFORMS
      .filter((p) => p.clientType === "browser")
      .map((p) => p.platform);
    expect(BROWSER_PLATFORMS).toEqual(expected);
  });

  it("includes only browser-dependent platforms (canva, zendesk)", () => {
    expect(BROWSER_PLATFORMS).toContain("canva");
    expect(BROWSER_PLATFORMS).toContain("zendesk");
  });

  it("does not include http-only platforms", () => {
    expect(BROWSER_PLATFORMS).not.toContain("shopify");
    expect(BROWSER_PLATFORMS).not.toContain("salesforce");
    expect(BROWSER_PLATFORMS).not.toContain("wix");
    expect(BROWSER_PLATFORMS).not.toContain("wordpress");
    expect(BROWSER_PLATFORMS).not.toContain("google_workspace");
    expect(BROWSER_PLATFORMS).not.toContain("atlassian");
    expect(BROWSER_PLATFORMS).not.toContain("zoom");
    expect(BROWSER_PLATFORMS).not.toContain("zoho");
    expect(BROWSER_PLATFORMS).not.toContain("hubspot");
  });
});

describe("getSmokeCheck", () => {
  it("returns check config for existing platform+check", () => {
    const result = getSmokeCheck("shopify", "categories");
    expect(result).toBeDefined();
    expect(result!.check).toBe("categories");
    expect(result!.arg).toBe("finding-products --pages first");
  });

  it("returns check config for a check without arg", () => {
    const result = getSmokeCheck("shopify", "featured");
    expect(result).toBeDefined();
    expect(result!.check).toBe("featured");
    expect(result!.arg).toBeUndefined();
  });

  it("returns undefined for N/A check (salesforce has no featured)", () => {
    const result = getSmokeCheck("salesforce", "featured");
    expect(result).toBeUndefined();
  });

  it("returns undefined for unknown platform", () => {
    const result = getSmokeCheck("nonexistent" as any, "categories");
    expect(result).toBeUndefined();
  });
});

describe("getSmokePlatform", () => {
  it("returns platform config for existing platform", () => {
    const result = getSmokePlatform("shopify");
    expect(result).toBeDefined();
    expect(result!.platform).toBe("shopify");
    expect(result!.clientType).toBe("http");
    expect(result!.timeoutSec).toBe(60);
  });

  it("returns undefined for unknown platform", () => {
    const result = getSmokePlatform("nonexistent" as any);
    expect(result).toBeUndefined();
  });
});

describe("countTotalSmokeChecks", () => {
  it("returns total number of actual checks across all platforms", () => {
    const total = countTotalSmokeChecks();
    const expected = SMOKE_PLATFORMS.reduce(
      (sum, p) => sum + p.checks.length,
      0
    );
    expect(total).toBe(expected);
    // Should be > 40 (11 platforms × ~4 checks each)
    expect(total).toBeGreaterThan(40);
  });
});
