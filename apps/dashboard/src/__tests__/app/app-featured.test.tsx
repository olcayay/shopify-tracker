import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock @/lib/api before importing the page
const mockGetAppFeaturedPlacements = vi.fn();

vi.mock("@/lib/api", () => ({
  getAppFeaturedPlacements: (...args: any[]) =>
    mockGetAppFeaturedPlacements(...args),
}));

// Mock the FeaturedHistory client component
vi.mock(
  "@/app/(dashboard)/[platform]/apps/[slug]/featured/featured-history",
  () => ({
    FeaturedHistory: ({ sightings }: { sightings: any[] }) => (
      <div data-testid="featured-history">
        {sightings.length === 0 ? (
          <p>No featured data</p>
        ) : (
          sightings.map((s: any, i: number) => (
            <span key={i}>{s.sectionTitle || s.sectionHandle}</span>
          ))
        )}
      </div>
    ),
  })
);

import AppFeaturedPage from "@/app/(dashboard)/[platform]/apps/[slug]/featured/page";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((el) => render(el));
}

describe("AppFeaturedPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = Promise.resolve({ platform: "shopify", slug: "test-app" });

  it("renders Featured Placement History title", async () => {
    mockGetAppFeaturedPlacements.mockResolvedValue({ sightings: [] });
    await renderAsync(AppFeaturedPage({ params }));
    expect(
      screen.getByText("Featured Placement History")
    ).toBeInTheDocument();
  });

  it("calls getAppFeaturedPlacements with correct slug and platform", async () => {
    mockGetAppFeaturedPlacements.mockResolvedValue({ sightings: [] });
    await renderAsync(AppFeaturedPage({ params }));
    expect(mockGetAppFeaturedPlacements).toHaveBeenCalledWith(
      "test-app",
      30,
      "shopify"
    );
  });

  it("renders section count when sightings exist", async () => {
    mockGetAppFeaturedPlacements.mockResolvedValue({
      sightings: [
        {
          surface: "home",
          surfaceDetail: "main",
          sectionHandle: "trending",
          sectionTitle: "Trending Apps",
          position: 1,
          seenDate: "2026-03-01",
          timesSeenInDay: 2,
        },
        {
          surface: "category",
          surfaceDetail: "tools",
          sectionHandle: "staff-picks",
          sectionTitle: "Staff Picks",
          position: 3,
          seenDate: "2026-03-01",
          timesSeenInDay: 1,
        },
      ],
    });
    await renderAsync(AppFeaturedPage({ params }));
    expect(screen.getByText(/2/)).toBeInTheDocument();
    expect(screen.getByText(/sections, last 30 days/)).toBeInTheDocument();
  });

  it("renders featured section names through FeaturedHistory component", async () => {
    mockGetAppFeaturedPlacements.mockResolvedValue({
      sightings: [
        {
          surface: "home",
          surfaceDetail: "main",
          sectionHandle: "trending",
          sectionTitle: "Trending Apps",
          position: 1,
          seenDate: "2026-03-01",
          timesSeenInDay: 2,
        },
      ],
    });
    await renderAsync(AppFeaturedPage({ params }));
    expect(screen.getByText("Trending Apps")).toBeInTheDocument();
  });

  it("handles empty sightings", async () => {
    mockGetAppFeaturedPlacements.mockResolvedValue({ sightings: [] });
    await renderAsync(AppFeaturedPage({ params }));
    expect(screen.getByTestId("featured-history")).toBeInTheDocument();
  });

  it("handles API error gracefully", async () => {
    mockGetAppFeaturedPlacements.mockRejectedValue(new Error("API error"));
    await renderAsync(AppFeaturedPage({ params }));
    expect(
      screen.getByText("Featured Placement History")
    ).toBeInTheDocument();
    expect(screen.getByTestId("featured-history")).toBeInTheDocument();
  });
});
