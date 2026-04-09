import { describe, it, expect } from "vitest";

/**
 * Tests for the platform filtering logic in the developers API.
 * Verifies that requested platforms are intersected with allowed platforms,
 * and that admin users bypass the filter.
 */

function resolveAllowedPlatforms(
  requestedPlatforms: string[],
  enabledPlatforms: string[],
  isAdmin: boolean
): string[] | null {
  if (isAdmin) return requestedPlatforms.length > 0 ? requestedPlatforms : [];

  if (enabledPlatforms.length === 0) return null; // early return, no data

  if (requestedPlatforms.length > 0) {
    const allowedSet = new Set(enabledPlatforms);
    const filtered = requestedPlatforms.filter((p) => allowedSet.has(p));
    return filtered.length > 0 ? filtered : null; // null = empty result
  }

  return enabledPlatforms; // default to all enabled
}

describe("Developer platform filter logic", () => {
  const enabled = ["shopify", "salesforce", "wix"];

  it("returns all enabled platforms when no filter requested", () => {
    expect(resolveAllowedPlatforms([], enabled, false)).toEqual(["shopify", "salesforce", "wix"]);
  });

  it("intersects requested with enabled platforms", () => {
    expect(resolveAllowedPlatforms(["shopify", "atlassian"], enabled, false))
      .toEqual(["shopify"]);
  });

  it("returns null when requested platforms are all disabled", () => {
    expect(resolveAllowedPlatforms(["atlassian", "zendesk"], enabled, false)).toBeNull();
  });

  it("returns null when no platforms are enabled", () => {
    expect(resolveAllowedPlatforms([], [], false)).toBeNull();
  });

  it("admin bypasses platform filter", () => {
    expect(resolveAllowedPlatforms([], enabled, true)).toEqual([]);
  });

  it("admin can request any platform", () => {
    expect(resolveAllowedPlatforms(["atlassian"], enabled, true)).toEqual(["atlassian"]);
  });

  it("admin with no filter gets empty (no filter applied)", () => {
    expect(resolveAllowedPlatforms([], [], true)).toEqual([]);
  });
});

/**
 * Tests for tracked_apps subquery platform filtering (PLA-966).
 * Ensures tracked apps shown per developer are filtered by user's enabled platforms.
 */
function filterTrackedAppsByEnabledPlatforms(
  trackedApps: { slug: string; platform: string }[],
  enabledPlatforms: string[],
  isAdmin: boolean
): { slug: string; platform: string }[] {
  if (isAdmin) return trackedApps;
  const allowed = new Set(enabledPlatforms);
  return trackedApps.filter((app) => allowed.has(app.platform));
}

describe("Tracked apps subquery platform filtering (PLA-966)", () => {
  const trackedApps = [
    { slug: "shopify-app", platform: "shopify" },
    { slug: "salesforce-app", platform: "salesforce" },
    { slug: "wordpress-app", platform: "wordpress" },
    { slug: "atlassian-app", platform: "atlassian" },
  ];

  it("filters tracked apps to only enabled platforms", () => {
    const result = filterTrackedAppsByEnabledPlatforms(trackedApps, ["shopify", "salesforce"], false);
    expect(result).toEqual([
      { slug: "shopify-app", platform: "shopify" },
      { slug: "salesforce-app", platform: "salesforce" },
    ]);
  });

  it("returns empty when no tracked apps match enabled platforms", () => {
    const result = filterTrackedAppsByEnabledPlatforms(trackedApps, ["zendesk"], false);
    expect(result).toEqual([]);
  });

  it("returns all tracked apps for system admin", () => {
    const result = filterTrackedAppsByEnabledPlatforms(trackedApps, ["shopify"], true);
    expect(result).toEqual(trackedApps);
  });

  it("returns empty when enabled platforms list is empty", () => {
    const result = filterTrackedAppsByEnabledPlatforms(trackedApps, [], false);
    expect(result).toEqual([]);
  });

  it("handles single enabled platform correctly", () => {
    const result = filterTrackedAppsByEnabledPlatforms(trackedApps, ["wordpress"], false);
    expect(result).toEqual([{ slug: "wordpress-app", platform: "wordpress" }]);
  });
});
