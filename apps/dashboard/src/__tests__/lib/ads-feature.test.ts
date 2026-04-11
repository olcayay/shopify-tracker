import { describe, it, expect, vi } from "vitest";
import { shouldShowAdsClient } from "@/lib/ads-feature";

// Mock the API module for the server version
vi.mock("@/lib/api", () => ({
  getEnabledFeatures: vi.fn(),
}));

import { getEnabledFeatures } from "@/lib/api";
import { shouldShowAds } from "@/lib/ads-feature-server";

const mockGetEnabledFeatures = getEnabledFeatures as ReturnType<typeof vi.fn>;

describe("shouldShowAds (server)", () => {
  it("returns false when platform has no ad tracking", async () => {
    mockGetEnabledFeatures.mockResolvedValue(["ads"]);
    expect(await shouldShowAds({ hasAdTracking: false })).toBe(false);
  });

  it("returns false when feature flag is not enabled", async () => {
    mockGetEnabledFeatures.mockResolvedValue(["platform-shopify"]);
    expect(await shouldShowAds({ hasAdTracking: true })).toBe(false);
  });

  it("returns true when both ad tracking and feature flag are enabled", async () => {
    mockGetEnabledFeatures.mockResolvedValue(["ads", "platform-shopify"]);
    expect(await shouldShowAds({ hasAdTracking: true })).toBe(true);
  });

  it("returns false when both are disabled", async () => {
    mockGetEnabledFeatures.mockResolvedValue([]);
    expect(await shouldShowAds({ hasAdTracking: false })).toBe(false);
  });
});

describe("shouldShowAdsClient", () => {
  it("returns false when platform has no ad tracking", () => {
    const hasFeature = () => true;
    expect(shouldShowAdsClient({ hasAdTracking: false }, hasFeature)).toBe(false);
  });

  it("returns false when feature flag is not enabled", () => {
    const hasFeature = (slug: string) => slug !== "ads";
    expect(shouldShowAdsClient({ hasAdTracking: true }, hasFeature)).toBe(false);
  });

  it("returns true when both ad tracking and feature flag are enabled", () => {
    const hasFeature = (slug: string) => slug === "ads";
    expect(shouldShowAdsClient({ hasAdTracking: true }, hasFeature)).toBe(true);
  });

  it("returns false when both are disabled", () => {
    const hasFeature = () => false;
    expect(shouldShowAdsClient({ hasAdTracking: false }, hasFeature)).toBe(false);
  });
});
