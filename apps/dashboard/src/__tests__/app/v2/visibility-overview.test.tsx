import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetApp = vi.fn();
const mockGetAppScores = vi.fn();
const mockGetAppScoresHistory = vi.fn();
const mockGetAppRankings = vi.fn();
const mockGetAppKeywords = vi.fn();
const mockGetAppFeaturedPlacements = vi.fn();
const mockGetAppAdSightings = vi.fn();

vi.mock("@/lib/api", () => ({
  getApp: (...args: any[]) => mockGetApp(...args),
  getAppScores: (...args: any[]) => mockGetAppScores(...args),
  getAppScoresHistory: (...args: any[]) => mockGetAppScoresHistory(...args),
  getAppRankings: (...args: any[]) => mockGetAppRankings(...args),
  getAppKeywords: (...args: any[]) => mockGetAppKeywords(...args),
  getAppFeaturedPlacements: (...args: any[]) => mockGetAppFeaturedPlacements(...args),
  getAppAdSightings: (...args: any[]) => mockGetAppAdSightings(...args),
}));

vi.mock("@/components/v2/visibility-trend-chart", () => ({
  VisibilityTrendChart: ({ history }: any) => (
    <div data-testid="visibility-trend-chart">{history.length} points</div>
  ),
}));

import VisibilityOverviewPage from "@/app/(dashboard)/[platform]/apps/v2/[slug]/visibility/page";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((el) => render(el));
}

const params = Promise.resolve({ platform: "shopify", slug: "test-app" });

function setupMocks() {
  mockGetApp.mockResolvedValue({
    slug: "test-app",
    name: "Test App",
    isTrackedByAccount: true,
  });
  mockGetAppScores.mockResolvedValue({
    visibility: [{ visibilityScore: 75, keywordCount: 20 }],
    power: [],
    weightedPowerScore: 50,
  });
  mockGetAppScoresHistory.mockResolvedValue({ history: [{ date: "2026-03-01", visibilityScore: 70, powerScore: 45 }] });
  mockGetAppRankings.mockResolvedValue({
    keywordRankings: [
      { keyword: "pos", keywordSlug: "pos", position: 3, scrapedAt: "2026-03-01" },
    ],
    categoryRankings: [],
  });
  mockGetAppKeywords.mockResolvedValue([]);
  mockGetAppFeaturedPlacements.mockResolvedValue({ sightings: [] });
  mockGetAppAdSightings.mockResolvedValue({ sightings: [] });
}

describe("VisibilityOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the visibility section", async () => {
    setupMocks();
    await renderAsync(VisibilityOverviewPage({ params }));
    // VisibilityTrendChart is dynamically imported (ssr: false) — container renders but chart is lazy
    expect(screen.getByText(/visibility/i)).toBeInTheDocument();
  });

  it("shows Visibility Score Breakdown when scores exist", async () => {
    setupMocks();
    await renderAsync(VisibilityOverviewPage({ params }));
    expect(screen.getByText("Visibility Score Breakdown")).toBeInTheDocument();
  });

  it("shows overall score value", async () => {
    setupMocks();
    await renderAsync(VisibilityOverviewPage({ params }));
    expect(screen.getByText("Overall Score")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();
  });

  it("shows Keywords ranked insight", async () => {
    setupMocks();
    await renderAsync(VisibilityOverviewPage({ params }));
    expect(screen.getByText("Keywords ranked")).toBeInTheDocument();
  });

  it("shows Best position insight", async () => {
    setupMocks();
    await renderAsync(VisibilityOverviewPage({ params }));
    expect(screen.getByText("Best position")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
  });

  it("shows error message on API failure", async () => {
    mockGetApp.mockRejectedValue(new Error("fail"));
    await renderAsync(VisibilityOverviewPage({ params }));
    expect(screen.getByText("Failed to load visibility data.")).toBeInTheDocument();
  });

  it("renders chart data points from history", async () => {
    setupMocks();
    await renderAsync(VisibilityOverviewPage({ params }));
    expect(screen.getByText("1 points")).toBeInTheDocument();
  });
});
