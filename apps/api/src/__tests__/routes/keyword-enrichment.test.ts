import { describe, it, expect } from "vitest";

/**
 * Tests to verify the keyword-to-trackedApps enrichment pattern
 * used in cross-platform.ts GET /api/cross-platform/keywords.
 *
 * This tests the data transformation logic that converts
 * trackedAppIds (number[]) into trackedApps (full app objects).
 */

interface TrackedApp {
  name: string;
  iconUrl: string | null;
  slug: string;
  platform: string;
}

function enrichKeywordWithTrackedApps(
  keywordAppMap: Map<number, number[]>,
  trackedAppDetailsMap: Map<number, TrackedApp>,
  keywordId: number
) {
  const appIds = keywordAppMap.get(keywordId) || [];
  return {
    appCount: appIds.length,
    trackedAppIds: appIds,
    trackedApps: appIds
      .map((id: number) => trackedAppDetailsMap.get(id))
      .filter(Boolean),
  };
}

describe("Keyword trackedApps enrichment", () => {
  const appDetailsMap = new Map<number, TrackedApp>([
    [1, { name: "Slack", iconUrl: "https://cdn.example.com/slack.png", slug: "slack", platform: "shopify" }],
    [2, { name: "Mailchimp", iconUrl: null, slug: "mailchimp", platform: "shopify" }],
    [3, { name: "Trello", iconUrl: "https://cdn.example.com/trello.png", slug: "trello", platform: "atlassian" }],
  ]);

  const keywordAppMap = new Map<number, number[]>([
    [100, [1, 2]],    // keyword 100 tracked by Slack and Mailchimp
    [200, [3]],        // keyword 200 tracked by Trello
    [300, []],         // keyword 300 has no tracked apps (research mode)
  ]);

  it("returns full app objects for tracked keywords", () => {
    const result = enrichKeywordWithTrackedApps(keywordAppMap, appDetailsMap, 100);
    expect(result.appCount).toBe(2);
    expect(result.trackedAppIds).toEqual([1, 2]);
    expect(result.trackedApps).toEqual([
      { name: "Slack", iconUrl: "https://cdn.example.com/slack.png", slug: "slack", platform: "shopify" },
      { name: "Mailchimp", iconUrl: null, slug: "mailchimp", platform: "shopify" },
    ]);
  });

  it("returns single app for keyword tracked by one app", () => {
    const result = enrichKeywordWithTrackedApps(keywordAppMap, appDetailsMap, 200);
    expect(result.appCount).toBe(1);
    expect(result.trackedApps).toHaveLength(1);
    expect(result.trackedApps[0]).toMatchObject({ slug: "trello", platform: "atlassian" });
  });

  it("returns empty arrays for research-mode keywords", () => {
    const result = enrichKeywordWithTrackedApps(keywordAppMap, appDetailsMap, 300);
    expect(result.appCount).toBe(0);
    expect(result.trackedAppIds).toEqual([]);
    expect(result.trackedApps).toEqual([]);
  });

  it("returns empty arrays for unknown keyword IDs", () => {
    const result = enrichKeywordWithTrackedApps(keywordAppMap, appDetailsMap, 999);
    expect(result.appCount).toBe(0);
    expect(result.trackedApps).toEqual([]);
  });

  it("filters out app IDs not found in details map", () => {
    const partialMap = new Map<number, number[]>([
      [100, [1, 99]], // 99 doesn't exist in details
    ]);
    const result = enrichKeywordWithTrackedApps(partialMap, appDetailsMap, 100);
    expect(result.appCount).toBe(2);
    expect(result.trackedAppIds).toEqual([1, 99]);
    expect(result.trackedApps).toHaveLength(1); // Only app 1 found
    expect(result.trackedApps[0]).toMatchObject({ slug: "slack" });
  });
});
