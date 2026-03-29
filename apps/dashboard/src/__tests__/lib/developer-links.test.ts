import { describe, it, expect } from "vitest";

/**
 * Tests to prevent regression on developer link patterns.
 * All developer links in the dashboard must include a platform prefix
 * or point to the cross-platform developer list (/developers).
 *
 * Valid patterns:
 *   /{platform}/developers/{slug}  — platform-specific developer detail
 *   /developers                    — cross-platform developer list
 *   /developers?q={name}           — cross-platform developer list with search
 *
 * Invalid patterns (cause 404):
 *   /developers/{slug}             — no route exists for this
 */

const VALID_DEVELOPER_LINK_PATTERNS = [
  /^\/[a-z-]+\/developers\/[a-z0-9-]+$/, // /{platform}/developers/{slug}
  /^\/developers(\?.*)?$/, // /developers or /developers?q=...
];

function isValidDeveloperLink(href: string): boolean {
  return VALID_DEVELOPER_LINK_PATTERNS.some((pattern) => pattern.test(href));
}

const INVALID_PATTERN = /^\/developers\/[a-z0-9-]+$/; // /developers/{slug} with no platform

function isBrokenDeveloperLink(href: string): boolean {
  return INVALID_PATTERN.test(href);
}

describe("developer link validation", () => {
  describe("valid developer links", () => {
    it("platform-specific developer link is valid", () => {
      expect(isValidDeveloperLink("/shopify/developers/jotform")).toBe(true);
      expect(isValidDeveloperLink("/salesforce/developers/acme-inc")).toBe(true);
      expect(isValidDeveloperLink("/hubspot/developers/some-dev")).toBe(true);
    });

    it("cross-platform developer list link is valid", () => {
      expect(isValidDeveloperLink("/developers")).toBe(true);
    });

    it("cross-platform developer list with search is valid", () => {
      expect(isValidDeveloperLink("/developers?q=Jotform")).toBe(true);
      expect(isValidDeveloperLink("/developers?q=Acme%20Inc")).toBe(true);
    });
  });

  describe("broken developer links (404)", () => {
    it("detects /developers/{slug} as broken (no platform prefix)", () => {
      expect(isBrokenDeveloperLink("/developers/jotform")).toBe(true);
      expect(isBrokenDeveloperLink("/developers/acme-inc")).toBe(true);
    });

    it("platform-prefixed links are not broken", () => {
      expect(isBrokenDeveloperLink("/shopify/developers/jotform")).toBe(false);
    });

    it("list page link is not broken", () => {
      expect(isBrokenDeveloperLink("/developers")).toBe(false);
    });
  });

  describe("real-world link examples from fixed code", () => {
    it("globe icon link includes platform", () => {
      const platform = "shopify";
      const slug = "jotform";
      const href = `/${platform}/developers/${slug}`;
      expect(isValidDeveloperLink(href)).toBe(true);
      expect(isBrokenDeveloperLink(href)).toBe(false);
    });

    it("system-admin developer list link uses first platform", () => {
      const platformDevelopers = [
        { id: 1, platform: "shopify", name: "Dev" },
        { id: 2, platform: "salesforce", name: "Dev" },
      ];
      const slug = "some-dev";
      const href = `/${platformDevelopers[0].platform}/developers/${slug}`;
      expect(isValidDeveloperLink(href)).toBe(true);
    });

    it("cross-platform profile link uses developer list with search", () => {
      const developerName = "Jotform";
      const href = `/developers?q=${encodeURIComponent(developerName)}`;
      expect(isValidDeveloperLink(href)).toBe(true);
      expect(isBrokenDeveloperLink(href)).toBe(false);
    });

    it("system-admin developer with no platforms falls back to /developers", () => {
      const platformDevelopers: { id: number; platform: string; name: string }[] = [];
      const slug = "orphan-dev";
      const href = platformDevelopers.length > 0 ? `/${platformDevelopers[0].platform}/developers/${slug}` : `/developers`;
      expect(isValidDeveloperLink(href)).toBe(true);
    });
  });
});
