import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { OverviewPlatformCard } from "@/components/overview-platform-card";

vi.mock("@appranks/shared", () => ({
  PLATFORMS: {
    shopify: { name: "Shopify", hasKeywordSearch: true, hasReviews: true },
  },
  PLATFORM_IDS: ["shopify"],
}));

vi.mock("@/lib/platform-display", () => ({
  PLATFORM_DISPLAY: {
    shopify: { label: "Shopify", color: "#95BF47", gradient: "", borderTop: "", textAccent: "" },
  },
}));

const makeApp = (slug: string, name: string, overrides: Partial<{ iconUrl: string | null; rating: number | null; reviewCount: number; keywordCount: number; competitorCount: number; developerName: string | null }> = {}) => ({
  slug,
  name,
  iconUrl: overrides.iconUrl ?? null,
  rating: overrides.rating ?? null,
  reviewCount: overrides.reviewCount ?? 0,
  keywordCount: overrides.keywordCount ?? 0,
  competitorCount: overrides.competitorCount ?? 0,
  developerName: overrides.developerName ?? null,
});

const mockData = {
  apps: [
    { slug: "my-app", name: "My App", iconUrl: "https://example.com/icon.png", rating: 4.5, reviewCount: 120, keywordCount: 8, competitorCount: 2, developerName: "Dev Co" },
    { slug: "other-app", name: "Other App", iconUrl: null, rating: null, reviewCount: 0, keywordCount: 0, competitorCount: 0, developerName: null },
  ],
  highlights: {
    keywordMovers: [],
    categoryMovers: [],
    reviewPulse: [],
    recentChanges: [],
    featuredSightings: [],
    competitorAlerts: [],
    adActivity: [],
  },
};

describe("OverviewPlatformCard", () => {
  it("renders platform name and stats summary", () => {
    render(
      <OverviewPlatformCard
        platformId="shopify"
        data={mockData}
        stats={{ apps: 2, keywords: 12, competitors: 5 }}
      />,
    );
    expect(screen.getByText("Shopify")).toBeInTheDocument();
    expect(screen.getByText("2 Apps")).toBeInTheDocument();
    expect(screen.getByText("12 Keywords")).toBeInTheDocument();
    expect(screen.getByText("5 Competitors")).toBeInTheDocument();
  });

  it("renders app rows for each tracked app", () => {
    render(
      <OverviewPlatformCard platformId="shopify" data={mockData} />
    );
    expect(screen.getByText("My App")).toBeInTheDocument();
    expect(screen.getByText("Other App")).toBeInTheDocument();
  });

  it("shows app rating and keyword count", () => {
    render(
      <OverviewPlatformCard platformId="shopify" data={mockData} />
    );
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("(120)")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("renders app icon when provided", () => {
    render(
      <OverviewPlatformCard platformId="shopify" data={mockData} />
    );
    const img = document.querySelector("img[src='https://example.com/icon.png']");
    expect(img).toBeInTheDocument();
  });

  it("renders fallback initial when no icon", () => {
    render(
      <OverviewPlatformCard platformId="shopify" data={mockData} />
    );
    // "Other App" has no icon, should show "O" initial
    expect(screen.getByText("O")).toBeInTheDocument();
  });

  it("shows empty state when no apps", () => {
    render(
      <OverviewPlatformCard
        platformId="shopify"
        data={{ ...mockData, apps: [] }}
      />
    );
    expect(screen.getByText(/No tracked apps/)).toBeInTheDocument();
    expect(screen.getByText("Start tracking")).toBeInTheDocument();
  });

  it("links app mini-cards to app detail pages", () => {
    render(
      <OverviewPlatformCard platformId="shopify" data={mockData} />
    );
    const link = screen.getByText("My App").closest("a");
    expect(link).toHaveAttribute("href", "/shopify/apps/my-app");
  });

  it("links platform header to platform overview", () => {
    render(
      <OverviewPlatformCard platformId="shopify" data={mockData} />
    );
    const link = screen.getByText("Shopify").closest("a");
    expect(link).toHaveAttribute("href", "/shopify");
  });

  it("shows loading shimmer when highlights are loading and stats show tracked apps", () => {
    const { container } = render(
      <OverviewPlatformCard
        platformId="shopify"
        data={null}
        stats={{ apps: 3, keywords: 5, competitors: 1 }}
        highlightsLoading={true}
      />,
    );
    // Should NOT show empty state
    expect(screen.queryByText(/No tracked apps/)).not.toBeInTheDocument();
    // Should show skeleton row placeholders (min of stats.apps=3, cap=4)
    // Each skeleton row has a parent div with py-2 class
    const skeletonRows = container.querySelectorAll(".flex.items-center.gap-3.py-2");
    expect(skeletonRows.length).toBe(3);
  });

  it("caps loading shimmer skeletons at 4", () => {
    const { container } = render(
      <OverviewPlatformCard
        platformId="shopify"
        data={null}
        stats={{ apps: 10, keywords: 5, competitors: 1 }}
        highlightsLoading={true}
      />,
    );
    expect(screen.queryByText(/No tracked apps/)).not.toBeInTheDocument();
    const skeletonRows = container.querySelectorAll(".flex.items-center.gap-3.py-2");
    expect(skeletonRows.length).toBe(4);
  });

  it("shows empty state when highlights finished loading and no apps", () => {
    render(
      <OverviewPlatformCard
        platformId="shopify"
        data={null}
        stats={{ apps: 0, keywords: 0, competitors: 0 }}
        highlightsLoading={false}
      />,
    );
    expect(screen.getByText(/No tracked apps/)).toBeInTheDocument();
  });

  it("shows empty state (not shimmer) when highlightsLoading but stats.apps is 0", () => {
    render(
      <OverviewPlatformCard
        platformId="shopify"
        data={null}
        stats={{ apps: 0, keywords: 0, competitors: 0 }}
        highlightsLoading={true}
      />,
    );
    // Even though highlights are loading, stats say 0 apps — show empty state
    expect(screen.getByText(/No tracked apps/)).toBeInTheDocument();
  });

  it("shows only first 5 apps and a 'View all' link when more than 5 apps", () => {
    const manyApps = Array.from({ length: 8 }, (_, i) =>
      makeApp(`app-${i}`, `App ${i}`, { rating: 4.0, reviewCount: 10, keywordCount: 3 }),
    );
    render(
      <OverviewPlatformCard
        platformId="shopify"
        data={{ ...mockData, apps: manyApps }}
      />,
    );
    // First 5 should be visible
    for (let i = 0; i < 5; i++) {
      expect(screen.getByText(`App ${i}`)).toBeInTheDocument();
    }
    // 6th and beyond should NOT be visible
    expect(screen.queryByText("App 5")).not.toBeInTheDocument();
    expect(screen.queryByText("App 7")).not.toBeInTheDocument();
    // "View all" link should appear
    const viewAll = screen.getByText("View all 8 apps");
    expect(viewAll).toBeInTheDocument();
    expect(viewAll.closest("a")).toHaveAttribute("href", "/shopify/apps");
  });

  it("does not show 'View all' link when apps count is within limit", () => {
    render(
      <OverviewPlatformCard platformId="shopify" data={mockData} />,
    );
    expect(screen.queryByText(/View all/)).not.toBeInTheDocument();
  });

  it("renders app rows as compact single-line items in a list layout", () => {
    const { container } = render(
      <OverviewPlatformCard platformId="shopify" data={mockData} />,
    );
    // Apps should be in a flex column (divide-y list)
    const appList = container.querySelector(".flex.flex-col.divide-y");
    expect(appList).toBeInTheDocument();
    // App rows should be flex items with py-2 (compact rows)
    const appRows = appList!.querySelectorAll("a.flex.items-center");
    expect(appRows.length).toBe(2);
  });

  it("renders keyword count in a badge", () => {
    render(
      <OverviewPlatformCard platformId="shopify" data={mockData} />,
    );
    // Keyword count 8 should be in a rounded-full badge
    const badge = screen.getByText("8").closest("span");
    expect(badge?.className).toContain("rounded-full");
  });
});
