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

  it("validates canva bulk path data", () => {
    const result = validatePlatformData("canva", {
      canvaAppId: "AAF_8lkU9VE",
      canvaAppType: "SDK_APP",
      description: "Short desc",
      tagline: "A tagline",
      fullDescription: "Full desc",
      topics: ["marketplace_topic.ai_audio"],
      urlSlug: "ai-music",
    });
    expect(result.success).toBe(true);
  });

  it("validates canva detail path data", () => {
    const result = validatePlatformData("canva", {
      canvaAppId: "AAF_8lkU9VE",
      description: "Short desc",
      tagline: "A tagline",
      fullDescription: "Full desc",
      screenshots: ["https://example.com/ss.png"],
      promoCardUrl: "https://example.com/promo.png",
      developerEmail: "dev@example.com",
      developerPhone: "+1234567890",
      developerAddress: { street: "123 Main", city: "NYC", country: "US", state: "NY", zip: "10001" },
      termsUrl: "https://example.com/terms",
      privacyUrl: "https://example.com/privacy",
      permissions: [{ scope: "read_design", type: "MANDATORY" }],
      languages: ["en", "fr"],
    });
    expect(result.success).toBe(true);
  });

  it("validates canva data with null developerAddress", () => {
    const result = validatePlatformData("canva", {
      canvaAppId: "AAF_8lkU9VE",
      developerAddress: null,
    });
    expect(result.success).toBe(true);
  });
});
