import { describe, it, expect, vi, afterEach } from "vitest";
import { isAdsEnabled, shouldShowAds } from "@/lib/ads-feature";

describe("isAdsEnabled", () => {
  const originalEnv = process.env.NEXT_PUBLIC_ADS_ENABLED;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_ADS_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_ADS_ENABLED = originalEnv;
    }
  });

  it("returns false when env var is not set", () => {
    delete process.env.NEXT_PUBLIC_ADS_ENABLED;
    expect(isAdsEnabled()).toBe(false);
  });

  it("returns false when env var is 'false'", () => {
    process.env.NEXT_PUBLIC_ADS_ENABLED = "false";
    expect(isAdsEnabled()).toBe(false);
  });

  it("returns true when env var is 'true'", () => {
    process.env.NEXT_PUBLIC_ADS_ENABLED = "true";
    expect(isAdsEnabled()).toBe(true);
  });
});

describe("shouldShowAds", () => {
  const originalEnv = process.env.NEXT_PUBLIC_ADS_ENABLED;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_ADS_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_ADS_ENABLED = originalEnv;
    }
  });

  it("returns false when both disabled", () => {
    delete process.env.NEXT_PUBLIC_ADS_ENABLED;
    expect(shouldShowAds({ hasAdTracking: false })).toBe(false);
  });

  it("returns false when platform has ads but feature flag off", () => {
    delete process.env.NEXT_PUBLIC_ADS_ENABLED;
    expect(shouldShowAds({ hasAdTracking: true })).toBe(false);
  });

  it("returns false when feature flag on but platform has no ads", () => {
    process.env.NEXT_PUBLIC_ADS_ENABLED = "true";
    expect(shouldShowAds({ hasAdTracking: false })).toBe(false);
  });

  it("returns true only when both enabled", () => {
    process.env.NEXT_PUBLIC_ADS_ENABLED = "true";
    expect(shouldShowAds({ hasAdTracking: true })).toBe(true);
  });
});
