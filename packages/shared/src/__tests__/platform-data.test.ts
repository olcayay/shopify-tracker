import { describe, it, expect } from "vitest";
import { getPlatformData } from "../types/platform-data/index.js";

describe("getPlatformData", () => {
  it("returns typed shopify data", () => {
    const raw = { appIntroduction: "Hello", seoTitle: "Test" };
    const data = getPlatformData("shopify", raw);
    expect(data.appIntroduction).toBe("Hello");
    expect(data.seoTitle).toBe("Test");
  });

  it("returns typed hubspot data", () => {
    const raw = { certified: true, installCount: 500 };
    const data = getPlatformData("hubspot", raw);
    expect(data.certified).toBe(true);
    expect(data.installCount).toBe(500);
  });

  it("handles null/undefined input", () => {
    const data = getPlatformData("shopify", null);
    expect(data).toEqual({});
  });

  it("handles empty object", () => {
    const data = getPlatformData("salesforce", {});
    expect(data).toEqual({});
  });

  it("preserves all fields from raw data", () => {
    const raw = {
      cloudFortified: true,
      topVendor: false,
      vendorName: "Acme",
      totalInstalls: 1000,
    };
    const data = getPlatformData("atlassian", raw);
    expect(data.cloudFortified).toBe(true);
    expect(data.topVendor).toBe(false);
    expect(data.vendorName).toBe("Acme");
    expect(data.totalInstalls).toBe(1000);
  });
});
