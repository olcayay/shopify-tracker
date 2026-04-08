import { describe, it, expect } from "vitest";
import { getMetadataLimits } from "../metadata-limits.js";
import type { MetadataLimits } from "../metadata-limits.js";

const SUPPORTED_PLATFORMS = [
  "shopify",
  "salesforce",
  "canva",
  "wix",
  "wordpress",
  "google_workspace",
  "atlassian",
  "zoom",
  "zoho",
  "zendesk",
  "hubspot",
  "woocommerce",
] as const;

const REQUIRED_FIELDS: (keyof MetadataLimits)[] = [
  "appName",
  "subtitle",
  "introduction",
  "details",
  "feature",
  "seoTitle",
  "seoMetaDescription",
];

describe("getMetadataLimits", () => {
  it('returns shopify limits for "shopify"', () => {
    const limits = getMetadataLimits("shopify");
    expect(limits.appName).toBe(30);
    expect(limits.subtitle).toBe(62);
    expect(limits.introduction).toBe(100);
    expect(limits.details).toBe(500);
  });

  it('returns canva limits for "canva" (appName: 18)', () => {
    const limits = getMetadataLimits("canva");
    expect(limits.appName).toBe(18);
  });

  it('returns salesforce limits for "salesforce"', () => {
    const limits = getMetadataLimits("salesforce");
    expect(limits.appName).toBe(80);
    expect(limits.introduction).toBe(500);
    expect(limits.details).toBe(2000);
  });

  it("returns default (shopify) limits for unknown platform", () => {
    const limits = getMetadataLimits("unknown_platform");
    const shopifyLimits = getMetadataLimits("shopify");
    expect(limits).toEqual(shopifyLimits);
  });

  it("all 12 platforms have limits defined", () => {
    for (const platform of SUPPORTED_PLATFORMS) {
      const limits = getMetadataLimits(platform);
      expect(limits).toBeDefined();
    }
  });

  it("each platform's limits have all required fields", () => {
    for (const platform of SUPPORTED_PLATFORMS) {
      const limits = getMetadataLimits(platform);
      for (const field of REQUIRED_FIELDS) {
        expect(limits).toHaveProperty(field);
      }
    }
  });

  it("all limit values are non-negative numbers", () => {
    for (const platform of SUPPORTED_PLATFORMS) {
      const limits = getMetadataLimits(platform);
      for (const field of REQUIRED_FIELDS) {
        const value = limits[field];
        expect(typeof value).toBe("number");
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
