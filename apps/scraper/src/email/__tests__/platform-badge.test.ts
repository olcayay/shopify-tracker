import { describe, it, expect } from "vitest";
import { platformBadge, platformLabel, platformSubjectPrefix } from "../components/platform-badge.js";

describe("platformLabel", () => {
  it("returns correct labels for all 12 platforms", () => {
    expect(platformLabel("shopify")).toBe("Shopify");
    expect(platformLabel("salesforce")).toBe("Salesforce");
    expect(platformLabel("canva")).toBe("Canva");
    expect(platformLabel("wix")).toBe("Wix");
    expect(platformLabel("wordpress")).toBe("WordPress");
    expect(platformLabel("google-workspace")).toBe("Google Workspace");
    expect(platformLabel("atlassian")).toBe("Atlassian");
    expect(platformLabel("zoom")).toBe("Zoom");
    expect(platformLabel("zoho")).toBe("Zoho");
    expect(platformLabel("zendesk")).toBe("Zendesk");
    expect(platformLabel("hubspot")).toBe("HubSpot");
    expect(platformLabel("woocommerce")).toBe("WooCommerce");
  });

  it("normalizes underscore platform slugs to proper labels", () => {
    expect(platformLabel("google_workspace")).toBe("Google Workspace");
    expect(platformLabel("woocommerce")).toBe("WooCommerce");
  });

  it("capitalizes unknown platforms with proper word splitting", () => {
    expect(platformLabel("my_custom_platform")).toBe("My Custom Platform");
    expect(platformLabel("my-custom-platform")).toBe("My Custom Platform");
  });

  it("returns 'Unknown' for undefined/null/empty platform", () => {
    expect(platformLabel(undefined as any)).toBe("Unknown");
    expect(platformLabel(null as any)).toBe("Unknown");
    expect(platformLabel("")).toBe("Unknown");
  });
});

describe("platformSubjectPrefix", () => {
  it("wraps label in brackets", () => {
    expect(platformSubjectPrefix("shopify")).toBe("[Shopify]");
    expect(platformSubjectPrefix("zoom")).toBe("[Zoom]");
  });
});

describe("platformBadge", () => {
  it("returns HTML span with platform color", () => {
    const badge = platformBadge("shopify");
    expect(badge).toContain("Shopify");
    expect(badge).toContain("#95BF47");
    expect(badge).toContain("<span");
  });

  it("uses fallback color for unknown platform", () => {
    const badge = platformBadge("unknown");
    expect(badge).toContain("#6b7280");
    expect(badge).toContain("Unknown");
  });

  it("uses correct color for underscore platform slugs", () => {
    const badge = platformBadge("google_workspace");
    expect(badge).toContain("Google Workspace");
    expect(badge).toContain("#4285F4");
  });
});
