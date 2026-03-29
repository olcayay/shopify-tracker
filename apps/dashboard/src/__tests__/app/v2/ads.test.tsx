import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetAppAdSightings = vi.fn();
const mockGetAppCategoryAdSightings = vi.fn();

vi.mock("@/lib/api", () => ({
  getAppAdSightings: (...args: any[]) => mockGetAppAdSightings(...args),
  getAppCategoryAdSightings: (...args: any[]) => mockGetAppCategoryAdSightings(...args),
}));

vi.mock(
  "@/app/(dashboard)/[platform]/apps/[slug]/ads/ad-history",
  () => ({
    AppAdHistory: ({ sightings }: any) => (
      <div data-testid="ad-history">{sightings.length} sightings</div>
    ),
  })
);

vi.mock("@/components/ad-heatmap", () => ({
  AdHeatmap: ({ sightings }: any) => (
    <div data-testid="ad-heatmap">{sightings.length} entries</div>
  ),
}));

import V2AdsPage from "@/app/(dashboard)/[platform]/apps/v2/[slug]/visibility/ads/page";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((el) => render(el));
}

const params = Promise.resolve({ platform: "shopify", slug: "test-app" });

describe("V2AdsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Keyword Ad History card", async () => {
    mockGetAppAdSightings.mockResolvedValue({ sightings: [] });
    mockGetAppCategoryAdSightings.mockResolvedValue({ sightings: [] });
    await renderAsync(V2AdsPage({ params }));
    expect(screen.getByText("Keyword Ad History")).toBeInTheDocument();
  });

  it("renders Category Ad History card", async () => {
    mockGetAppAdSightings.mockResolvedValue({ sightings: [] });
    mockGetAppCategoryAdSightings.mockResolvedValue({ sightings: [] });
    await renderAsync(V2AdsPage({ params }));
    expect(screen.getByText("Category Ad History")).toBeInTheDocument();
  });

  it("shows keyword count when sightings exist", async () => {
    mockGetAppAdSightings.mockResolvedValue({
      sightings: [
        { keywordSlug: "pos", seenDate: "2026-03-01", timesSeenInDay: 1 },
        { keywordSlug: "checkout", seenDate: "2026-03-01", timesSeenInDay: 2 },
      ],
    });
    mockGetAppCategoryAdSightings.mockResolvedValue({ sightings: [] });
    await renderAsync(V2AdsPage({ params }));
    expect(screen.getByText(/2 keywords, last 30 days/)).toBeInTheDocument();
  });

  it("shows empty category message when no category sightings", async () => {
    mockGetAppAdSightings.mockResolvedValue({ sightings: [] });
    mockGetAppCategoryAdSightings.mockResolvedValue({ sightings: [] });
    await renderAsync(V2AdsPage({ params }));
    expect(screen.getByText(/No category ad sightings/)).toBeInTheDocument();
  });

  it("renders ad heatmap for category data", async () => {
    mockGetAppAdSightings.mockResolvedValue({ sightings: [] });
    mockGetAppCategoryAdSightings.mockResolvedValue({
      sightings: [
        { categorySlug: "tools", categoryTitle: "Tools", seenDate: "2026-03-01", timesSeenInDay: 3 },
      ],
    });
    await renderAsync(V2AdsPage({ params }));
    expect(screen.getByTestId("ad-heatmap")).toBeInTheDocument();
  });

  it("handles API errors gracefully", async () => {
    mockGetAppAdSightings.mockRejectedValue(new Error("fail"));
    mockGetAppCategoryAdSightings.mockRejectedValue(new Error("fail"));
    await renderAsync(V2AdsPage({ params }));
    expect(screen.getByText("Keyword Ad History")).toBeInTheDocument();
    expect(screen.getByText("Category Ad History")).toBeInTheDocument();
  });

  it("renders ad-history component with correct sighting count", async () => {
    mockGetAppAdSightings.mockResolvedValue({
      sightings: [
        { keywordSlug: "pos", seenDate: "2026-03-01", timesSeenInDay: 1 },
      ],
    });
    mockGetAppCategoryAdSightings.mockResolvedValue({ sightings: [] });
    await renderAsync(V2AdsPage({ params }));
    expect(screen.getByTestId("ad-history")).toBeInTheDocument();
    expect(screen.getByText("1 sightings")).toBeInTheDocument();
  });
});
