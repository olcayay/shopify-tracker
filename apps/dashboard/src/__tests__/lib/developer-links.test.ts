import { describe, it, expect } from "vitest";

/**
 * Tests to prevent regression on developer link patterns.
 *
 * Valid patterns (user-facing URLs):
 *   /developers/{slug}              — cross-platform developer profile
 *   /{platform}/developers/{slug}   — platform-specific developer detail
 *   /developers                     — cross-platform developer list
 *
 * Note: /developers/{slug} is rewritten to /developer/{slug} (singular) internally
 * by middleware to avoid Next.js [platform] dynamic param conflict. Links in code
 * should always use the plural /developers/{slug} form.
 *
 * Invalid/deprecated patterns:
 *   /developers?q={name}            — should use /developers/{slug} instead
 */

const VALID_DEVELOPER_LINK_PATTERNS = [
  /^\/developers\/[a-z0-9-]+$/, // /developers/{slug} — cross-platform profile
  /^\/[a-z-]+\/developers\/[a-z0-9-]+$/, // /{platform}/developers/{slug}
  /^\/developers$/, // /developers (list, no query params)
];

function isValidDeveloperLink(href: string): boolean {
  return VALID_DEVELOPER_LINK_PATTERNS.some((pattern) => pattern.test(href));
}

// These patterns are broken/deprecated and should not be used
const BROKEN_PATTERNS = [
  /^\/developers\?q=/, // /developers?q= — old search pattern, use /developers/{slug}
];

function isBrokenDeveloperLink(href: string): boolean {
  return BROKEN_PATTERNS.some((pattern) => pattern.test(href));
}

describe("developer link validation", () => {
  describe("valid developer links", () => {
    it("cross-platform developer profile is valid", () => {
      expect(isValidDeveloperLink("/developers/jotform")).toBe(true);
      expect(isValidDeveloperLink("/developers/acme-inc")).toBe(true);
    });

    it("platform-specific developer link is valid", () => {
      expect(isValidDeveloperLink("/shopify/developers/jotform")).toBe(true);
      expect(isValidDeveloperLink("/salesforce/developers/acme-inc")).toBe(true);
      expect(isValidDeveloperLink("/hubspot/developers/some-dev")).toBe(true);
    });

    it("cross-platform developer list link is valid", () => {
      expect(isValidDeveloperLink("/developers")).toBe(true);
    });
  });

  describe("broken/deprecated developer links", () => {
    it("/developers?q= is broken (should use /developers/{slug})", () => {
      expect(isBrokenDeveloperLink("/developers?q=Jotform")).toBe(true);
      expect(isBrokenDeveloperLink("/developers?q=Acme%20Inc")).toBe(true);
    });

    it("valid links are not detected as broken", () => {
      expect(isBrokenDeveloperLink("/developers/jotform")).toBe(false);
      expect(isBrokenDeveloperLink("/shopify/developers/jotform")).toBe(false);
      expect(isBrokenDeveloperLink("/developers")).toBe(false);
    });
  });

  describe("real-world link examples from current code", () => {
    it("developer list links to cross-platform profile", () => {
      const slug = "jotform";
      const href = `/developers/${slug}`;
      expect(isValidDeveloperLink(href)).toBe(true);
      expect(isBrokenDeveloperLink(href)).toBe(false);
    });

    it("platform page 'View cross-platform profile' links to /developers/{slug}", () => {
      const slug = "jotform";
      const href = `/developers/${slug}`;
      expect(isValidDeveloperLink(href)).toBe(true);
    });

    it("system-admin developer list links to cross-platform profile", () => {
      const slug = "some-dev";
      const href = `/developers/${slug}`;
      expect(isValidDeveloperLink(href)).toBe(true);
    });

    it("platform badge on cross-platform page links to platform-specific page", () => {
      const platform = "shopify";
      const slug = "jotform";
      const href = `/${platform}/developers/${slug}`;
      expect(isValidDeveloperLink(href)).toBe(true);
    });
  });
});
