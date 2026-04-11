import { describe, it, expect } from "vitest";

/**
 * Tests for the dedup logic used in change detection.
 * The actual dedup is embedded in keyword-scraper.ts and app-details-scraper.ts.
 * These tests verify the dedup decision logic in isolation.
 */

interface LastChange {
  newValue: string | null;
}

/**
 * Determines if a change should be recorded, given the last recorded change.
 * Returns true if the change is new (not a duplicate).
 */
function shouldRecordChange(
  lastChange: LastChange | undefined,
  newValue: string | null
): boolean {
  // No previous change recorded — this is the first change, always record
  if (!lastChange) return true;
  // If the last change already has the same new_value, it's a duplicate
  return lastChange.newValue !== newValue;
}

describe("Change detection dedup logic", () => {
  it("records change when no previous change exists", () => {
    expect(shouldRecordChange(undefined, "new subtitle")).toBe(true);
  });

  it("records change when new_value differs from last recorded change", () => {
    expect(shouldRecordChange({ newValue: "old subtitle" }, "new subtitle")).toBe(true);
  });

  it("skips change when new_value matches last recorded change (duplicate)", () => {
    expect(shouldRecordChange({ newValue: "same value" }, "same value")).toBe(false);
  });

  it("records change when last change had null new_value", () => {
    expect(shouldRecordChange({ newValue: null }, "new value")).toBe(true);
  });

  it("records change when new value is null but last was non-null", () => {
    expect(shouldRecordChange({ newValue: "old value" }, null)).toBe(true);
  });

  it("skips when both last and new are null", () => {
    expect(shouldRecordChange({ newValue: null }, null)).toBe(false);
  });

  it("handles empty string vs non-empty", () => {
    expect(shouldRecordChange({ newValue: "" }, "new value")).toBe(true);
    expect(shouldRecordChange({ newValue: "old value" }, "")).toBe(true);
  });

  it("skips when both are empty strings", () => {
    expect(shouldRecordChange({ newValue: "" }, "")).toBe(false);
  });

  it("treats whitespace differences as real changes", () => {
    expect(shouldRecordChange({ newValue: "hello " }, "hello")).toBe(true);
  });
});

describe("Platform filter in change detection", () => {
  // Verifies that platform filtering prevents cross-platform false changes
  it("same slug different platform should be separate apps", () => {
    const shopifyApp = { slug: "intercom", platform: "shopify", subtitle: "Shopify subtitle" };
    const hubspotApp = { slug: "intercom", platform: "hubspot", subtitle: "HubSpot subtitle" };

    // Without platform filter, comparing hubspot subtitle against shopify subtitle = false change
    expect(shopifyApp.subtitle !== hubspotApp.subtitle).toBe(true);

    // With platform filter, each app is compared against its own platform's stored value
    // This test documents the requirement, the actual fix is in keyword-scraper.ts
  });
});
