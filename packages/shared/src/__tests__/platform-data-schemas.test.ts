import { describe, it, expect } from "vitest";
import { validatePlatformData } from "../types/platform-data/schemas.js";

describe("validatePlatformData", () => {
  it("validates correct shopify data", () => {
    const result = validatePlatformData("shopify", {
      appIntroduction: "Hello",
      seoTitle: "Test",
      languages: ["en", "fr"],
    });
    expect(result.success).toBe(true);
  });

  it("validates correct hubspot data", () => {
    const result = validatePlatformData("hubspot", {
      certified: true,
      installCount: 500,
      launchedDate: "2024-01-01",
    });
    expect(result.success).toBe(true);
  });

  it("passes with extra fields (passthrough)", () => {
    const result = validatePlatformData("shopify", {
      appIntroduction: "Hello",
      unknownField: "extra",
    });
    expect(result.success).toBe(true);
  });

  it("fails with wrong field types", () => {
    const result = validatePlatformData("shopify", {
      languages: "not-an-array",
    });
    expect(result.success).toBe(false);
  });

  it("handles null/undefined input", () => {
    const result = validatePlatformData("shopify", null);
    expect(result.success).toBe(true);
  });

  it("handles empty object", () => {
    const result = validatePlatformData("salesforce", {});
    expect(result.success).toBe(true);
  });

  it("validates atlassian data with booleans", () => {
    const result = validatePlatformData("atlassian", {
      cloudFortified: true,
      topVendor: false,
      totalInstalls: 5000,
    });
    expect(result.success).toBe(true);
  });

  it("fails when boolean expected but string given", () => {
    const result = validatePlatformData("atlassian", {
      cloudFortified: "yes",
    });
    expect(result.success).toBe(false);
  });
});
