import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock @/lib/api before importing the page
const mockGetAppAdSightings = vi.fn();
const mockGetAppCategoryAdSightings = vi.fn();

vi.mock("@/lib/api", () => ({
  getAppAdSightings: (...args: any[]) => mockGetAppAdSightings(...args),
  getAppCategoryAdSightings: (...args: any[]) =>
    mockGetAppCategoryAdSightings(...args),
}));

// Mock the AppAdHistory client component
vi.mock(
  "@/app/(dashboard)/[platform]/apps/[slug]/ads/ad-history",
  () => ({
    AppAdHistory: ({ sightings }: { sightings: any[] }) => (
      <div data-testid="ad-history">
        {sightings.length === 0 ? (
          <p>No keyword ad sightings</p>
        ) : (
          sightings.map((s: any, i: number) => (
            <span key={i}>{s.keyword}</span>
          ))
        )}
      </div>
    ),
  })
);

// Mock AdHeatmap for category ads
vi.mock("@/components/ad-heatmap", () => ({
  AdHeatmap: ({ sightings }: { sightings: any[] }) => (
    <div data-testid="ad-heatmap">
      {sightings.map((s: any, i: number) => (
        <span key={i}>{s.name}</span>
      ))}
    </div>
  ),
}));

import AppAdsPage from "@/app/(dashboard)/[platform]/apps/[slug]/ads/page";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((el) => render(el));
}

describe("AppAdsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = Promise.resolve({ platform: "shopify", slug: "test-app" });

  it("renders Keyword Ad History title", async () => {
    mockGetAppAdSightings.mockResolvedValue({ sightings: [] });
    mockGetAppCategoryAdSightings.mockResolvedValue({ sightings: [] });
    await renderAsync(AppAdsPage({ params }));
    expect(screen.getByText("Keyword Ad History")).toBeInTheDocument();
  });

  it("renders Category Ad History title", async () => {
    mockGetAppAdSightings.mockResolvedValue({ sightings: [] });
    mockGetAppCategoryAdSightings.mockResolvedValue({ sightings: [] });
    await renderAsync(AppAdsPage({ params }));
    expect(screen.getByText("Category Ad History")).toBeInTheDocument();
  });

  it("calls getAppAdSightings with correct params", async () => {
    mockGetAppAdSightings.mockResolvedValue({ sightings: [] });
    mockGetAppCategoryAdSightings.mockResolvedValue({ sightings: [] });
    await renderAsync(AppAdsPage({ params }));
    expect(mockGetAppAdSightings).toHaveBeenCalledWith(
      "test-app",
      30,
      "shopify"
    );
  });

  it("calls getAppCategoryAdSightings with correct params", async () => {
    mockGetAppAdSightings.mockResolvedValue({ sightings: [] });
    mockGetAppCategoryAdSightings.mockResolvedValue({ sightings: [] });
    await renderAsync(AppAdsPage({ params }));
    expect(mockGetAppCategoryAdSightings).toHaveBeenCalledWith(
      "test-app",
      30,
      "shopify"
    );
  });

  it("renders keyword count when keyword sightings exist", async () => {
    mockGetAppAdSightings.mockResolvedValue({
      sightings: [
        {
          keywordId: 1,
          keyword: "pos system",
          keywordSlug: "pos-system",
          seenDate: "2026-03-01",
          timesSeenInDay: 2,
        },
        {
          keywordId: 2,
          keyword: "inventory management",
          keywordSlug: "inventory-management",
          seenDate: "2026-03-01",
          timesSeenInDay: 1,
        },
      ],
    });
    mockGetAppCategoryAdSightings.mockResolvedValue({ sightings: [] });
    await renderAsync(AppAdsPage({ params }));
    expect(screen.getByText(/2/)).toBeInTheDocument();
    expect(screen.getByText(/keywords, last 30 days/)).toBeInTheDocument();
  });

  it("renders category heatmap when category sightings exist", async () => {
    mockGetAppAdSightings.mockResolvedValue({ sightings: [] });
    mockGetAppCategoryAdSightings.mockResolvedValue({
      sightings: [
        {
          categorySlug: "tools",
          categoryTitle: "Store Management",
          seenDate: "2026-03-01",
          timesSeenInDay: 3,
        },
      ],
    });
    await renderAsync(AppAdsPage({ params }));
    expect(screen.getByTestId("ad-heatmap")).toBeInTheDocument();
    expect(screen.getByText("Store Management")).toBeInTheDocument();
  });

  it("shows empty category message when no category sightings", async () => {
    mockGetAppAdSightings.mockResolvedValue({ sightings: [] });
    mockGetAppCategoryAdSightings.mockResolvedValue({ sightings: [] });
    await renderAsync(AppAdsPage({ params }));
    expect(
      screen.getByText(
        "No category ad sightings recorded for this app yet."
      )
    ).toBeInTheDocument();
  });

  it("handles API error gracefully", async () => {
    mockGetAppAdSightings.mockRejectedValue(new Error("API error"));
    mockGetAppCategoryAdSightings.mockRejectedValue(new Error("API error"));
    await renderAsync(AppAdsPage({ params }));
    expect(screen.getByText("Keyword Ad History")).toBeInTheDocument();
    expect(screen.getByText("Category Ad History")).toBeInTheDocument();
  });
});
