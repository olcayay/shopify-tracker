import { describe, expect, it } from "vitest";
import {
  resolveGloballyVisiblePlatforms,
  resolveVisiblePlatformsForAccount,
} from "../../utils/platform-visibility.js";

describe("platform visibility utils", () => {
  describe("resolveVisiblePlatformsForAccount", () => {
    it("intersects subscribed platforms with enabled flags", () => {
      const subscribed = ["shopify", "canva", "wix"];
      const enabled = new Set(["shopify", "canva"]);
      expect(resolveVisiblePlatformsForAccount(subscribed, enabled)).toEqual([
        "shopify",
        "canva",
      ]);
    });

    it("hides platforms whose flag is not enabled", () => {
      const subscribed = ["shopify", "wix"];
      const enabled = new Set<string>(["shopify"]);
      expect(resolveVisiblePlatformsForAccount(subscribed, enabled)).toEqual(["shopify"]);
    });

    it("returns empty when no flags match subscription", () => {
      expect(
        resolveVisiblePlatformsForAccount(["wix"], new Set(["shopify"])),
      ).toEqual([]);
    });

    it("returns empty when subscription is empty", () => {
      expect(
        resolveVisiblePlatformsForAccount([], new Set(["shopify", "canva"])),
      ).toEqual([]);
    });

    it("never leaks platforms that are enabled but not subscribed", () => {
      const subscribed = ["shopify"];
      const enabled = new Set(["shopify", "canva", "hubspot"]);
      expect(resolveVisiblePlatformsForAccount(subscribed, enabled)).toEqual(["shopify"]);
    });
  });

  describe("resolveGloballyVisiblePlatforms", () => {
    it("keeps only platforms present in the global-enabled set", () => {
      expect(
        resolveGloballyVisiblePlatforms(
          ["shopify", "wix", "bigcommerce"],
          new Set(["shopify"]),
        ),
      ).toEqual(["shopify"]);
    });

    it("returns empty when no platform is globally enabled", () => {
      expect(resolveGloballyVisiblePlatforms(["shopify", "wix"], new Set())).toEqual([]);
    });

    it("returns all when every platform is globally enabled", () => {
      expect(
        resolveGloballyVisiblePlatforms(["shopify", "wix"], new Set(["shopify", "wix"])),
      ).toEqual(["shopify", "wix"]);
    });
  });
});
