import { describe, it, expect, vi } from "vitest";

// Avoid importing the whole React page (pulls Next.js server deps into jsdom).
// Re-declare the minimal hook we need to mock, then import the page.
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ fetchWithAuth: vi.fn() }) }));
vi.mock("@/hooks/use-platform-access", () => ({
  usePlatformAccess: () => ({ accessiblePlatforms: [] }),
}));
vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));

import { filterDeveloperForVisiblePlatforms } from "@/app/(dashboard)/developers/page";

function makeDev(overrides: Partial<Parameters<typeof filterDeveloperForVisiblePlatforms>[0]> = {}) {
  return {
    id: 1,
    slug: "mega-dev",
    name: "Mega Dev",
    website: null,
    platformCount: 3,
    linkCount: 5,
    appCount: 47,
    platforms: ["shopify", "salesforce", "wix"],
    appCountsByPlatform: { shopify: 30, salesforce: 12, wix: 5 },
    topApps: Array.from({ length: 10 }, (_, i) => ({
      iconUrl: `https://example.com/${i}.png`,
      name: `App ${i}`,
      slug: `app-${i}`,
      platform: i < 6 ? "shopify" : i < 9 ? "salesforce" : "wix",
    })),
    isStarred: false,
    ...overrides,
  };
}

describe("filterDeveloperForVisiblePlatforms — PLA-1102", () => {
  it("returns full appCount when no platform filter is active", () => {
    const dev = makeDev();
    const out = filterDeveloperForVisiblePlatforms(dev, []);
    expect(out).not.toBeNull();
    expect(out!.appCount).toBe(47);
  });

  it("sums per-platform counts for enabled platforms — does NOT clamp to topApps.length (10)", () => {
    // Regression: previously `Math.min(dev.appCount, topApps.length)` silently
    // capped prolific developers at 10 apps, breaking App Count sort + the +N
    // overflow badge. Fix returns the real sum (30 + 12 = 42 for shopify+salesforce).
    const dev = makeDev();
    const out = filterDeveloperForVisiblePlatforms(dev, ["shopify", "salesforce"]);
    expect(out).not.toBeNull();
    expect(out!.appCount).toBe(42);
    expect(out!.appCount).toBeGreaterThan(out!.topApps.length);
  });

  it("returns the single-platform per-platform count when only one platform is enabled", () => {
    const dev = makeDev();
    const out = filterDeveloperForVisiblePlatforms(dev, ["shopify"]);
    expect(out!.appCount).toBe(30);
  });

  it("falls back to the full dev.appCount when appCountsByPlatform is missing (API rollback safety)", () => {
    // If an older API response shape arrives without the breakdown, the filter
    // must not silently return 0 — it falls back to the full appCount so the UI
    // stays informative rather than blank.
    const dev = makeDev({ appCountsByPlatform: {} });
    const out = filterDeveloperForVisiblePlatforms(dev, ["shopify"]);
    expect(out!.appCount).toBe(47);
  });

  it("returns null when no enabled platform matches the developer's platforms and no visible apps remain", () => {
    const dev = makeDev({
      platforms: ["shopify"],
      appCountsByPlatform: { shopify: 5 },
      topApps: [
        { iconUrl: "x", name: "a", slug: "a", platform: "shopify" },
      ],
    });
    const out = filterDeveloperForVisiblePlatforms(dev, ["wix"]);
    expect(out).toBeNull();
  });
});
