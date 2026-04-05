import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock @/lib/api
const mockGetApp = vi.fn();
const mockGetAppScores = vi.fn();
const mockGetAppScoresHistory = vi.fn();
const mockGetAppRankings = vi.fn();
const mockGetAppChanges = vi.fn();
const mockGetAppReviews = vi.fn();
const mockGetAppFeaturedPlacements = vi.fn();
const mockGetAppAdSightings = vi.fn();
const mockGetAppCompetitors = vi.fn();
const mockGetAppKeywords = vi.fn();

vi.mock("@/lib/api", () => ({
  getApp: (...args: any[]) => mockGetApp(...args),
  getAppScores: (...args: any[]) => mockGetAppScores(...args),
  getAppScoresHistory: (...args: any[]) => mockGetAppScoresHistory(...args),
  getAppRankings: (...args: any[]) => mockGetAppRankings(...args),
  getAppChanges: (...args: any[]) => mockGetAppChanges(...args),
  getAppReviews: (...args: any[]) => mockGetAppReviews(...args),
  getAppFeaturedPlacements: (...args: any[]) => mockGetAppFeaturedPlacements(...args),
  getAppAdSightings: (...args: any[]) => mockGetAppAdSightings(...args),
  getAppCompetitors: (...args: any[]) => mockGetAppCompetitors(...args),
  getAppKeywords: (...args: any[]) => mockGetAppKeywords(...args),
}));

// Mock complex child components
vi.mock("@/components/v2/health-score-bar", () => ({
  HealthScoreBar: (props: any) => (
    <div data-testid="health-score-bar">
      {props.visibilityScore != null && <span>Vis: {props.visibilityScore}</span>}
      {props.powerScore != null && <span>Pow: {props.powerScore}</span>}
      {props.keywordCount != null && <span>KW: {props.keywordCount}</span>}
    </div>
  ),
}));

vi.mock("@/components/v2/alerts-card", () => ({
  AlertsCard: ({ alerts }: any) => (
    <div data-testid="alerts-card">{alerts.length} alerts</div>
  ),
  generateAlerts: () => [],
}));

vi.mock("@/lib/metadata-limits", () => ({
  getMetadataLimits: () => ({
    appName: 60,
    subtitle: 80,
    introduction: 0,
    details: 5000,
    seoTitle: 70,
    seoMetaDescription: 320,
  }),
}));

import V2DashboardPage from "@/app/(dashboard)/[platform]/apps/v2/[slug]/page";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((el) => render(el));
}

const params = Promise.resolve({ platform: "shopify", slug: "test-app" });

function setupDefaultMocks(overrides: Record<string, any> = {}) {
  mockGetApp.mockResolvedValue({
    slug: "test-app",
    name: "Test App",
    isTrackedByAccount: true,
    isBuiltForShopify: false,
    latestSnapshot: {
      averageRating: 4.5,
      ratingCount: 100,
      appDetails: "A great app",
      features: ["Feature 1"],
    },
    ...overrides,
  });
  mockGetAppScores.mockResolvedValue({ visibility: [{ visibilityScore: 72 }], power: [], weightedPowerScore: 55 });
  mockGetAppScoresHistory.mockResolvedValue({ history: [] });
  mockGetAppRankings.mockResolvedValue({ categoryRankings: [], keywordRankings: [] });
  mockGetAppChanges.mockResolvedValue([]);
  mockGetAppReviews.mockResolvedValue({ reviews: [], total: 0, distribution: [] });
  mockGetAppFeaturedPlacements.mockResolvedValue({ sightings: [] });
  mockGetAppAdSightings.mockResolvedValue({ sightings: [] });
  mockGetAppCompetitors.mockResolvedValue([]);
  mockGetAppKeywords.mockResolvedValue([]);
}

describe("V2DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the health score bar", async () => {
    setupDefaultMocks();
    await renderAsync(V2DashboardPage({ params }));
    expect(screen.getByTestId("health-score-bar")).toBeInTheDocument();
  });

  it("renders alerts card", async () => {
    setupDefaultMocks();
    await renderAsync(V2DashboardPage({ params }));
    expect(screen.getByTestId("alerts-card")).toBeInTheDocument();
  });

  it("shows Visibility Snapshot card", async () => {
    setupDefaultMocks();
    await renderAsync(V2DashboardPage({ params }));
    expect(screen.getByText("Visibility Snapshot")).toBeInTheDocument();
  });

  it("shows Competitive Snapshot card", async () => {
    setupDefaultMocks();
    await renderAsync(V2DashboardPage({ params }));
    expect(screen.getByText("Competitive Snapshot")).toBeInTheDocument();
  });

  it("shows Listing Health card", async () => {
    setupDefaultMocks();
    await renderAsync(V2DashboardPage({ params }));
    expect(screen.getByText("Listing Health")).toBeInTheDocument();
  });

  it("displays 'App not found.' on API failure", async () => {
    mockGetApp.mockRejectedValue(new Error("Not found"));
    await renderAsync(V2DashboardPage({ params }));
    expect(screen.getByText("App not found.")).toBeInTheDocument();
  });

  it("shows locked message for competitors when app is not tracked", async () => {
    setupDefaultMocks({ isTrackedByAccount: false });
    await renderAsync(V2DashboardPage({ params }));
    expect(screen.getByText("Track this app to see competitors")).toBeInTheDocument();
  });

  it("shows competitor names when tracked with competitors", async () => {
    setupDefaultMocks();
    mockGetAppCompetitors.mockResolvedValue([
      { appSlug: "comp-1", appName: "Competitor One", latestSnapshot: { averageRating: 4.2 } },
    ]);
    await renderAsync(V2DashboardPage({ params }));
    expect(screen.getByText("Competitor One")).toBeInTheDocument();
  });

  it("shows 'No keyword ranking changes' when no movers", async () => {
    setupDefaultMocks();
    await renderAsync(V2DashboardPage({ params }));
    expect(screen.getByText("No keyword ranking changes")).toBeInTheDocument();
  });

  it("renders navigation links", async () => {
    setupDefaultMocks();
    await renderAsync(V2DashboardPage({ params }));
    expect(screen.getByText("Go to Visibility")).toBeInTheDocument();
    expect(screen.getByText("Go to Listing Studio")).toBeInTheDocument();
  });
});
