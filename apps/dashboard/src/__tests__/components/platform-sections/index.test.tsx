import { describe, it, expect } from "vitest";
import { getPlatformSections } from "@/components/platform-sections";

describe("getPlatformSections", () => {
  const platforms = [
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
  ] as const;

  it.each(platforms)("returns sections for %s", (platform) => {
    const sections = getPlatformSections(platform);
    expect(Array.isArray(sections)).toBe(true);
    expect(sections.length).toBeGreaterThan(0);
  });

  it("returns empty array for unknown platform", () => {
    const sections = getPlatformSections("unknown_platform" as any);
    expect(sections).toEqual([]);
  });

  it("all sections have required id and component fields", () => {
    for (const platform of platforms) {
      const sections = getPlatformSections(platform);
      for (const section of sections) {
        expect(section.id).toBeTruthy();
        expect(typeof section.component).toBe("function");
      }
    }
  });

  it("all section IDs are unique across all platforms", () => {
    const allIds: string[] = [];
    for (const platform of platforms) {
      const sections = getPlatformSections(platform);
      for (const section of sections) {
        allIds.push(section.id);
      }
    }
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });
});
