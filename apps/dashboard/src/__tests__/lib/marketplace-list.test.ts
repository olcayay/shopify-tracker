import { describe, it, expect } from "vitest";
import { MARKETPLACE_LIST } from "@/lib/marketplace-list";

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

describe("MARKETPLACE_LIST", () => {
  it("is an array with at least 90 entries", () => {
    expect(Array.isArray(MARKETPLACE_LIST)).toBe(true);
    expect(MARKETPLACE_LIST.length).toBeGreaterThanOrEqual(90);
  });

  it("each entry has a name string", () => {
    for (const entry of MARKETPLACE_LIST) {
      expect(typeof entry.name).toBe("string");
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });

  it("entries with platformId have valid platform IDs", () => {
    const entriesWithPlatform = MARKETPLACE_LIST.filter((e) => e.platformId);
    for (const entry of entriesWithPlatform) {
      expect(SUPPORTED_PLATFORMS).toContain(entry.platformId);
    }
  });

  it("exactly 12 entries have platformId set", () => {
    const count = MARKETPLACE_LIST.filter((e) => e.platformId).length;
    expect(count).toBe(12);
  });

  it("is sorted alphabetically by name", () => {
    const names = MARKETPLACE_LIST.map((e) => e.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it("all 12 supported platforms are represented", () => {
    const platformIds = MARKETPLACE_LIST
      .filter((e) => e.platformId)
      .map((e) => e.platformId);
    for (const platform of SUPPORTED_PLATFORMS) {
      expect(platformIds).toContain(platform);
    }
  });

  it("has no duplicate names", () => {
    const names = MARKETPLACE_LIST.map((e) => e.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
