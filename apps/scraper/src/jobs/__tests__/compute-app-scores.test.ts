import { describe, it, expect } from "vitest";
import { PLATFORMS, type PlatformId } from "@appranks/shared";

/**
 * getPrerequisiteTypes is a private function in compute-app-scores.ts.
 * Replicated here for unit testing.
 */
const BASE_PREREQUISITE_TYPES = ["app_details", "category"] as const;

function getPrerequisiteTypes(platform: PlatformId): string[] {
  const platformConfig = PLATFORMS[platform];
  const types: string[] = [...BASE_PREREQUISITE_TYPES];
  if (platformConfig.hasKeywordSearch) types.push("keyword_search");
  if (platformConfig.hasReviews) types.push("reviews");
  return types;
}

describe("getPrerequisiteTypes", () => {
  it("always includes app_details and category", () => {
    for (const platformId of Object.keys(PLATFORMS) as PlatformId[]) {
      const types = getPrerequisiteTypes(platformId);
      expect(types).toContain("app_details");
      expect(types).toContain("category");
    }
  });

  it("includes keyword_search for platforms with keyword search", () => {
    // All 10 platforms have keyword search
    for (const platformId of Object.keys(PLATFORMS) as PlatformId[]) {
      const types = getPrerequisiteTypes(platformId);
      expect(types).toContain("keyword_search");
    }
  });

  it("includes reviews for platforms with reviews", () => {
    const platformsWithReviews = (Object.keys(PLATFORMS) as PlatformId[])
      .filter((id) => PLATFORMS[id].hasReviews);

    for (const platformId of platformsWithReviews) {
      const types = getPrerequisiteTypes(platformId);
      expect(types).toContain("reviews");
    }
  });

  it("does NOT include reviews for platforms without reviews", () => {
    const platformsWithoutReviews = (Object.keys(PLATFORMS) as PlatformId[])
      .filter((id) => !PLATFORMS[id].hasReviews);

    for (const platformId of platformsWithoutReviews) {
      const types = getPrerequisiteTypes(platformId);
      expect(types).not.toContain("reviews");
    }
  });

  it("Shopify includes all 4 types", () => {
    const types = getPrerequisiteTypes("shopify");
    expect(types).toEqual(["app_details", "category", "keyword_search", "reviews"]);
  });

  it("returns correct count based on platform capabilities", () => {
    for (const platformId of Object.keys(PLATFORMS) as PlatformId[]) {
      const config = PLATFORMS[platformId];
      const types = getPrerequisiteTypes(platformId);
      let expected = 2; // base
      if (config.hasKeywordSearch) expected++;
      if (config.hasReviews) expected++;
      expect(types).toHaveLength(expected);
    }
  });
});
