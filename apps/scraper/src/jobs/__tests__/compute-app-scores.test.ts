import { describe, it, expect, vi } from "vitest";
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

/**
 * Replicate checkPrerequisites fallback logic for unit testing.
 * The real function uses SQL; this tests the classification logic.
 */
function classifyPrerequisites(
  prerequisiteTypes: string[],
  completedToday: string[],
  completedYesterday: string[],
): { missing: string[]; usedFallback: boolean } {
  const todaySet = new Set(completedToday);
  const missingToday = prerequisiteTypes.filter((t) => !todaySet.has(t));

  if (missingToday.length === 0) {
    return { missing: [], usedFallback: false };
  }

  const yesterdaySet = new Set(completedYesterday);
  const stillMissing = missingToday.filter((t) => !yesterdaySet.has(t));

  return {
    missing: stillMissing,
    usedFallback: stillMissing.length === 0 && missingToday.length > 0,
  };
}

describe("checkPrerequisites fallback logic", () => {
  const allTypes = ["app_details", "category", "keyword_search", "reviews"];

  it("returns no missing when all completed today", () => {
    const result = classifyPrerequisites(allTypes, allTypes, []);
    expect(result.missing).toEqual([]);
    expect(result.usedFallback).toBe(false);
  });

  it("falls back to yesterday when today is missing some types", () => {
    const result = classifyPrerequisites(
      allTypes,
      ["app_details", "keyword_search", "reviews"], // category missing today
      ["category"], // but completed yesterday
    );
    expect(result.missing).toEqual([]);
    expect(result.usedFallback).toBe(true);
  });

  it("reports missing when neither today nor yesterday has the type", () => {
    const result = classifyPrerequisites(
      allTypes,
      ["app_details", "keyword_search"],   // category + reviews missing today
      ["category"],                          // only category from yesterday
    );
    expect(result.missing).toEqual(["reviews"]);
    expect(result.usedFallback).toBe(false);
  });

  it("reports all missing when nothing completed today or yesterday", () => {
    const result = classifyPrerequisites(allTypes, [], []);
    expect(result.missing).toEqual(allTypes);
    expect(result.usedFallback).toBe(false);
  });

  it("does not use fallback when today has all types (even if yesterday also has them)", () => {
    const result = classifyPrerequisites(allTypes, allTypes, allTypes);
    expect(result.missing).toEqual([]);
    expect(result.usedFallback).toBe(false);
  });

  it("handles partial today + partial yesterday covering all types", () => {
    const result = classifyPrerequisites(
      allTypes,
      ["app_details", "reviews"],           // 2 from today
      ["category", "keyword_search"],        // 2 from yesterday
    );
    expect(result.missing).toEqual([]);
    expect(result.usedFallback).toBe(true);
  });
});
