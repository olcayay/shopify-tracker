import { describe, expect, it } from "vitest";
import {
  resolveGloballyVisiblePlatforms,
  resolveVisiblePlatformsForAccount,
} from "../../utils/platform-visibility.js";

describe("platform visibility utils", () => {
  describe("resolveVisiblePlatformsForAccount", () => {
    it("keeps enabled platforms that are globally visible", () => {
      expect(resolveVisiblePlatformsForAccount([
        { platform: "shopify", override: false, isVisible: true },
        { platform: "wix", override: false, isVisible: null },
      ])).toEqual(["shopify", "wix"]);
    });

    it("filters globally hidden platforms without override", () => {
      expect(resolveVisiblePlatformsForAccount([
        { platform: "shopify", override: false, isVisible: true },
        { platform: "wix", override: false, isVisible: false },
      ])).toEqual(["shopify"]);
    });

    it("keeps hidden platforms when account overrides global visibility", () => {
      expect(resolveVisiblePlatformsForAccount([
        { platform: "shopify", override: false, isVisible: true },
        { platform: "wix", override: true, isVisible: false },
      ])).toEqual(["shopify", "wix"]);
    });
  });

  describe("resolveGloballyVisiblePlatforms", () => {
    it("filters only explicitly hidden platforms", () => {
      expect(resolveGloballyVisiblePlatforms(
        ["shopify", "wix", "bigcommerce"],
        [
          { platform: "wix", isVisible: false },
          { platform: "shopify", isVisible: true },
        ],
      )).toEqual(["shopify", "bigcommerce"]);
    });

    it("returns all platforms when there are no visibility rows", () => {
      expect(resolveGloballyVisiblePlatforms(["shopify", "wix"], [])).toEqual(["shopify", "wix"]);
    });
  });
});
