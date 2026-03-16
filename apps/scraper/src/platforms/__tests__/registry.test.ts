import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getModule, clearModuleCache } from "../registry.js";

describe("platform registry", () => {
  // Clear cache before each test group to avoid cross-test pollution
  it("getModule('shopify') returns module with platformId 'shopify'", () => {
    clearModuleCache();
    const mod = getModule("shopify");
    assert.equal(mod.platformId, "shopify");
  });

  it("getModule('salesforce') returns module with platformId 'salesforce'", () => {
    clearModuleCache();
    const mod = getModule("salesforce");
    assert.equal(mod.platformId, "salesforce");
  });

  it("getModule('canva') returns module with platformId 'canva'", () => {
    clearModuleCache();
    const mod = getModule("canva");
    assert.equal(mod.platformId, "canva");
  });

  it("getModule('wix') returns module with platformId 'wix'", () => {
    clearModuleCache();
    const mod = getModule("wix");
    assert.equal(mod.platformId, "wix");
  });

  it("returns cached module on second call (same reference)", () => {
    clearModuleCache();
    const first = getModule("shopify");
    const second = getModule("shopify");
    assert.equal(first, second, "should return the same cached instance");
  });

  it("clearModuleCache() causes next call to return new instance", () => {
    clearModuleCache();
    const first = getModule("shopify");
    clearModuleCache();
    const second = getModule("shopify");
    assert.notEqual(
      first,
      second,
      "should return a different instance after cache clear"
    );
  });
});
