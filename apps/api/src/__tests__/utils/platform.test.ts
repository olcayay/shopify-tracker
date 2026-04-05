import { describe, it, expect } from "vitest";
import { PLATFORMS } from "@appranks/shared";
import { getPlatformFromQuery, requireCapability } from "../../utils/platform.js";

describe("getPlatformFromQuery", () => {
  it('returns "shopify" when no platform in query', () => {
    expect(getPlatformFromQuery({ other: "value" })).toBe("shopify");
  });

  it('returns "shopify" when query is empty object', () => {
    expect(getPlatformFromQuery({})).toBe("shopify");
  });

  it("returns the platform when valid (salesforce)", () => {
    expect(getPlatformFromQuery({ platform: "salesforce" })).toBe("salesforce");
  });

  it("returns the platform when valid (canva)", () => {
    expect(getPlatformFromQuery({ platform: "canva" })).toBe("canva");
  });

  it("throws with statusCode 400 for invalid platform", () => {
    try {
      getPlatformFromQuery({ platform: "invalid_platform" });
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
      expect(err.message).toContain("Invalid platform");
    }
  });

  it("falls back to shopify for empty string platform (falsy)", () => {
    // Empty string is falsy, so `|| "shopify"` kicks in
    expect(getPlatformFromQuery({ platform: "" })).toBe("shopify");
  });

  it("all 12 valid platform IDs are accepted", () => {
    const platformIds = Object.keys(PLATFORMS);
    expect(platformIds).toHaveLength(12);
    for (const id of platformIds) {
      expect(getPlatformFromQuery({ platform: id })).toBe(id);
    }
  });
});

describe("requireCapability", () => {
  it("does not throw for a capability that is true", () => {
    // shopify has hasKeywordSearch: true
    expect(() => requireCapability("shopify", "hasKeywordSearch")).not.toThrow();
  });

  it("throws with statusCode 400 for a capability that is false", () => {
    // salesforce has hasFeaturedSections: false
    try {
      requireCapability("salesforce", "hasFeaturedSections");
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
    }
  });

  it("error message includes the platform name", () => {
    try {
      requireCapability("canva", "hasReviews");
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.message).toContain("Canva");
    }
  });
});
