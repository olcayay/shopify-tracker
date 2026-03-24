import { describe, it, expect } from "vitest";
import { getModule, clearModuleCache } from "../registry.js";

describe("platform registry", () => {
  // Clear cache before each test group to avoid cross-test pollution
  it("getModule('shopify') returns module with platformId 'shopify'", () => {
    clearModuleCache();
    const mod = getModule("shopify");
    expect(mod.platformId).toBe("shopify");
  });

  it("getModule('salesforce') returns module with platformId 'salesforce'", () => {
    clearModuleCache();
    const mod = getModule("salesforce");
    expect(mod.platformId).toBe("salesforce");
  });

  it("getModule('canva') returns module with platformId 'canva'", () => {
    clearModuleCache();
    const mod = getModule("canva");
    expect(mod.platformId).toBe("canva");
  });

  it("getModule('wix') returns module with platformId 'wix'", () => {
    clearModuleCache();
    const mod = getModule("wix");
    expect(mod.platformId).toBe("wix");
  });

  it("returns cached module on second call (same reference)", () => {
    clearModuleCache();
    const first = getModule("shopify");
    const second = getModule("shopify");
    expect(first).toBe(second, "should return the same cached instance");
  });

  it("clearModuleCache() causes next call to return new instance", () => {
    clearModuleCache();
    const first = getModule("shopify");
    clearModuleCache();
    const second = getModule("shopify");
    expect(first).not.toBe(second,
      "should return a different instance after cache clear");
  });
});
