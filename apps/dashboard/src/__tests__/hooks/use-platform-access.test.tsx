import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";

// Mock auth context
const mockAuth = vi.fn();
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => mockAuth(),
}));

// Mock feature flags context
const mockFeatureFlags = vi.fn();
vi.mock("@/contexts/feature-flags-context", () => ({
  useFeatureFlags: () => mockFeatureFlags(),
}));

import { usePlatformAccess } from "@/hooks/use-platform-access";

describe("usePlatformAccess", () => {
  it("returns all platforms for system admin", () => {
    mockAuth.mockReturnValue({
      user: { isSystemAdmin: true },
      account: { enabledPlatforms: ["shopify"] },
    });
    mockFeatureFlags.mockReturnValue({
      hasFeature: () => true,
    });

    const { result } = renderHook(() => usePlatformAccess());
    // System admin sees all 12 platforms
    expect(result.current.accessiblePlatforms).toHaveLength(12);
    expect(result.current.hasPlatformAccess("shopify")).toBe(true);
    expect(result.current.hasPlatformAccess("zendesk")).toBe(true);
  });

  it("filters platforms by feature flags for regular users", () => {
    mockAuth.mockReturnValue({
      user: { isSystemAdmin: false },
      account: { enabledPlatforms: ["shopify", "salesforce", "canva"] },
    });
    // Only shopify and canva flags are enabled
    mockFeatureFlags.mockReturnValue({
      hasFeature: (slug: string) =>
        slug === "platform-shopify" || slug === "platform-canva",
    });

    const { result } = renderHook(() => usePlatformAccess());
    expect(result.current.accessiblePlatforms).toEqual(["shopify", "canva"]);
    expect(result.current.hasPlatformAccess("shopify")).toBe(true);
    expect(result.current.hasPlatformAccess("canva")).toBe(true);
    expect(result.current.hasPlatformAccess("salesforce")).toBe(false);
  });

  it("returns empty list when no platforms are enabled", () => {
    mockAuth.mockReturnValue({
      user: { isSystemAdmin: false },
      account: { enabledPlatforms: [] },
    });
    mockFeatureFlags.mockReturnValue({
      hasFeature: () => true,
    });

    const { result } = renderHook(() => usePlatformAccess());
    expect(result.current.accessiblePlatforms).toEqual([]);
  });

  it("returns empty list when all platform flags are disabled", () => {
    mockAuth.mockReturnValue({
      user: { isSystemAdmin: false },
      account: { enabledPlatforms: ["shopify", "salesforce"] },
    });
    mockFeatureFlags.mockReturnValue({
      hasFeature: () => false,
    });

    const { result } = renderHook(() => usePlatformAccess());
    expect(result.current.accessiblePlatforms).toEqual([]);
    expect(result.current.hasPlatformAccess("shopify")).toBe(false);
  });

  it("handles missing account gracefully", () => {
    mockAuth.mockReturnValue({
      user: { isSystemAdmin: false },
      account: null,
    });
    mockFeatureFlags.mockReturnValue({
      hasFeature: () => true,
    });

    const { result } = renderHook(() => usePlatformAccess());
    expect(result.current.accessiblePlatforms).toEqual([]);
  });

  it("handles google_workspace underscore correctly", () => {
    mockAuth.mockReturnValue({
      user: { isSystemAdmin: false },
      account: { enabledPlatforms: ["google_workspace"] },
    });
    mockFeatureFlags.mockReturnValue({
      hasFeature: (slug: string) => slug === "platform-google-workspace",
    });

    const { result } = renderHook(() => usePlatformAccess());
    expect(result.current.accessiblePlatforms).toEqual(["google_workspace"]);
    expect(result.current.hasPlatformAccess("google_workspace")).toBe(true);
  });
});
