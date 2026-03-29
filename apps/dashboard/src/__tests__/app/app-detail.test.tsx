import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mock @/lib/api — server component fetches
const mockGetApp = vi.fn();
const mockGetAppReviews = vi.fn();
const mockGetAppRankings = vi.fn();
const mockGetAppChanges = vi.fn();
const mockGetAppCompetitors = vi.fn();
const mockGetAppKeywords = vi.fn();
const mockGetAppReviewMetrics = vi.fn();
const mockGetAppFeaturedPlacements = vi.fn();
const mockGetAppAdSightings = vi.fn();
const mockGetAppSimilarApps = vi.fn();
const mockGetAppsMinPaidPrices = vi.fn();
const mockGetCategoriesBatch = vi.fn();
const mockGetAppScores = vi.fn();

vi.mock("@/lib/api", () => ({
  getApp: (...args: any[]) => mockGetApp(...args),
  getAppReviews: (...args: any[]) => mockGetAppReviews(...args),
  getAppRankings: (...args: any[]) => mockGetAppRankings(...args),
  getAppChanges: (...args: any[]) => mockGetAppChanges(...args),
  getAppCompetitors: (...args: any[]) => mockGetAppCompetitors(...args),
  getAppKeywords: (...args: any[]) => mockGetAppKeywords(...args),
  getAppReviewMetrics: (...args: any[]) => mockGetAppReviewMetrics(...args),
  getAppFeaturedPlacements: (...args: any[]) => mockGetAppFeaturedPlacements(...args),
  getAppAdSightings: (...args: any[]) => mockGetAppAdSightings(...args),
  getAppSimilarApps: (...args: any[]) => mockGetAppSimilarApps(...args),
  getAppsMinPaidPrices: (...args: any[]) => mockGetAppsMinPaidPrices(...args),
  getCategoriesBatch: (...args: any[]) => mockGetCategoriesBatch(...args),
  getAppScores: (...args: any[]) => mockGetAppScores(...args),
}));

vi.mock("@/components/momentum-badge", () => ({
  MomentumBadge: ({ momentum }: any) => (
    <span data-testid="momentum-badge">{momentum}</span>
  ),
}));

vi.mock("@/components/visibility-score-popover", () => ({
  VisibilityScorePopover: () => <div data-testid="visibility-score-popover" />,
}));

vi.mock("@/components/power-score-popover", () => ({
  PowerScorePopover: () => <div data-testid="power-score-popover" />,
}));

import AppOverviewPage from "@/app/(dashboard)/[platform]/apps/[slug]/page";

const baseApp = {
  slug: "form-builder",
  name: "Form Builder Pro",
  iconUrl: "https://example.com/icon.png",
  developer: "Acme Inc",
  isTrackedByAccount: true,
  isBuiltForShopify: true,
  latestSnapshot: {
    averageRating: "4.8",
    ratingCount: 250,
    pricing: "Free plan available",
  },
};

function setupDefaultMocks() {
  mockGetApp.mockResolvedValue(baseApp);
  mockGetAppReviews.mockResolvedValue({
    reviews: [
      {
        rating: 5,
        reviewerName: "John",
        reviewDate: "2026-03-20",
        content: "Great app!",
      },
      {
        rating: 4,
        reviewerName: "Jane",
        reviewDate: "2026-03-19",
        content: "Pretty good",
      },
    ],
    total: 250,
    distribution: [
      { rating: 5, count: 150 },
      { rating: 4, count: 60 },
      { rating: 3, count: 20 },
      { rating: 2, count: 10 },
      { rating: 1, count: 10 },
    ],
  });
  mockGetAppRankings.mockResolvedValue({
    categoryRankings: [
      {
        categorySlug: "forms",
        categoryTitle: "Forms",
        position: 3,
        scrapedAt: "2026-03-20",
      },
      {
        categorySlug: "forms",
        categoryTitle: "Forms",
        position: 5,
        scrapedAt: "2026-03-19",
      },
    ],
    keywordRankings: [
      {
        keywordSlug: "form-builder",
        keyword: "form builder",
        position: 1,
        scrapedAt: "2026-03-20",
      },
      {
        keywordSlug: "form-builder",
        keyword: "form builder",
        position: 3,
        scrapedAt: "2026-03-19",
      },
    ],
  });
  mockGetAppChanges.mockResolvedValue([
    {
      field: "appDetails",
      detectedAt: "2026-03-20T10:00:00Z",
      oldValue: "Old details",
      newValue: "New details",
    },
  ]);
  mockGetAppCompetitors.mockResolvedValue([
    {
      appSlug: "competitor-app",
      appName: "Competitor App",
      iconUrl: "https://example.com/comp.png",
      latestSnapshot: { averageRating: "4.5", ratingCount: 180 },
      minPaidPrice: 14.99,
      recentChanges: [],
    },
  ]);
  mockGetAppKeywords.mockResolvedValue([
    { keyword: "form builder", slug: "form-builder", position: 1 },
    { keyword: "contact form", slug: "contact-form", position: 5 },
  ]);
  mockGetAppReviewMetrics.mockResolvedValue({
    v7d: 5,
    v30d: 20,
    v90d: 55,
    momentum: "rising",
  });
  mockGetAppFeaturedPlacements.mockResolvedValue({
    sightings: [{ sectionTitle: "Staff Picks" }],
  });
  mockGetAppAdSightings.mockResolvedValue({
    sightings: [{ keyword: "form builder" }],
  });
  mockGetAppSimilarApps.mockResolvedValue({
    direct: [],
    reverse: [{ slug: "other-app" }],
    secondDegree: [],
  });
  mockGetAppsMinPaidPrices.mockResolvedValue({ "form-builder": 9.99 });
  mockGetCategoriesBatch.mockResolvedValue({
    marketing: {
      leaders: [
        { slug: "form-builder", name: "Form Builder Pro", position: 3, iconUrl: null },
      ],
      appCount: 120,
    },
  });
  mockGetAppScores.mockResolvedValue({
    visibility: [],
    power: [],
    weightedPowerScore: 0,
  });
}

function setupNotFoundMocks() {
  mockGetApp.mockRejectedValue(new Error("Not found"));
  // All others should also reject to trigger the catch
  mockGetAppReviews.mockRejectedValue(new Error("Not found"));
  mockGetAppRankings.mockRejectedValue(new Error("Not found"));
  mockGetAppChanges.mockRejectedValue(new Error("Not found"));
  mockGetAppReviewMetrics.mockRejectedValue(new Error("Not found"));
  mockGetAppFeaturedPlacements.mockRejectedValue(new Error("Not found"));
  mockGetAppAdSightings.mockRejectedValue(new Error("Not found"));
  mockGetAppSimilarApps.mockRejectedValue(new Error("Not found"));
  mockGetAppsMinPaidPrices.mockRejectedValue(new Error("Not found"));
  mockGetAppScores.mockRejectedValue(new Error("Not found"));
}

describe("AppOverviewPage (Server Component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Review Pulse card", async () => {
    setupDefaultMocks();
    const page = await AppOverviewPage({
      params: Promise.resolve({ platform: "shopify", slug: "form-builder" }),
    });
    render(page);
    expect(screen.getByText("Review Pulse")).toBeInTheDocument();
  });

  it("shows 'App not found.' for 404", async () => {
    setupNotFoundMocks();
    const page = await AppOverviewPage({
      params: Promise.resolve({ platform: "shopify", slug: "nonexistent" }),
    });
    render(page);
    expect(screen.getByText("App not found.")).toBeInTheDocument();
  });

  it("renders review velocity data", async () => {
    setupDefaultMocks();
    const page = await AppOverviewPage({
      params: Promise.resolve({ platform: "shopify", slug: "form-builder" }),
    });
    render(page);
    expect(screen.getByText("+5")).toBeInTheDocument();
    expect(screen.getByText("+20")).toBeInTheDocument();
    expect(screen.getByText("+55")).toBeInTheDocument();
  });

  it("renders latest reviews", async () => {
    setupDefaultMocks();
    const page = await AppOverviewPage({
      params: Promise.resolve({ platform: "shopify", slug: "form-builder" }),
    });
    render(page);
    expect(screen.getByText("John")).toBeInTheDocument();
    expect(screen.getByText("Great app!")).toBeInTheDocument();
  });

  it("renders total review count link", async () => {
    setupDefaultMocks();
    const page = await AppOverviewPage({
      params: Promise.resolve({ platform: "shopify", slug: "form-builder" }),
    });
    render(page);
    expect(screen.getByText(/View all 250 reviews/)).toBeInTheDocument();
  });

  it("renders Category Rankings card", async () => {
    setupDefaultMocks();
    const page = await AppOverviewPage({
      params: Promise.resolve({ platform: "shopify", slug: "form-builder" }),
    });
    render(page);
    expect(screen.getByText("Category Rankings")).toBeInTheDocument();
    expect(screen.getByText("Forms")).toBeInTheDocument();
  });

  it("renders category ranking position", async () => {
    setupDefaultMocks();
    const page = await AppOverviewPage({
      params: Promise.resolve({ platform: "shopify", slug: "form-builder" }),
    });
    render(page);
    // Multiple elements may show #3 (ranking badge + leader position)
    const positions = screen.getAllByText("#3");
    expect(positions.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Keyword Performance card for tracked apps", async () => {
    setupDefaultMocks();
    const page = await AppOverviewPage({
      params: Promise.resolve({ platform: "shopify", slug: "form-builder" }),
    });
    render(page);
    expect(screen.getByText("Keyword Performance")).toBeInTheDocument();
  });

  it("renders keyword count info", async () => {
    setupDefaultMocks();
    const page = await AppOverviewPage({
      params: Promise.resolve({ platform: "shopify", slug: "form-builder" }),
    });
    render(page);
    expect(screen.getByText(/of 2 keywords ranked/)).toBeInTheDocument();
  });

  it("renders Competitor Watch card for tracked apps", async () => {
    setupDefaultMocks();
    const page = await AppOverviewPage({
      params: Promise.resolve({ platform: "shopify", slug: "form-builder" }),
    });
    render(page);
    expect(screen.getByText("Competitor Watch")).toBeInTheDocument();
  });

  it("renders competitor name", async () => {
    setupDefaultMocks();
    const page = await AppOverviewPage({
      params: Promise.resolve({ platform: "shopify", slug: "form-builder" }),
    });
    render(page);
    // Competitor name may appear in multiple cards (Competitor Watch + Competitor Updates)
    const elements = screen.getAllByText("Competitor App");
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders competitor count text", async () => {
    setupDefaultMocks();
    const page = await AppOverviewPage({
      params: Promise.resolve({ platform: "shopify", slug: "form-builder" }),
    });
    render(page);
    expect(screen.getByText(/competitor$/)).toBeInTheDocument();
  });

  it("calls getApp with correct slug and platform", async () => {
    setupDefaultMocks();
    await AppOverviewPage({
      params: Promise.resolve({ platform: "shopify", slug: "form-builder" }),
    });
    expect(mockGetApp).toHaveBeenCalledWith("form-builder", "shopify");
  });

  it("renders App Scores card", async () => {
    setupDefaultMocks();
    const page = await AppOverviewPage({
      params: Promise.resolve({ platform: "shopify", slug: "form-builder" }),
    });
    render(page);
    expect(screen.getByText("App Scores")).toBeInTheDocument();
  });

  it("does not render Review Pulse for platforms without reviews", async () => {
    setupDefaultMocks();
    mockGetApp.mockResolvedValue({ ...baseApp, isTrackedByAccount: false });
    mockGetAppReviews.mockResolvedValue({ reviews: [], total: 0, distribution: [] });
    mockGetAppCompetitors.mockResolvedValue([]);
    mockGetAppKeywords.mockResolvedValue([]);

    const page = await AppOverviewPage({
      params: Promise.resolve({ platform: "canva", slug: "form-builder" }),
    });
    render(page);
    // Canva has hasReviews: false, so Review Pulse should not appear
    expect(screen.queryByText("Review Pulse")).not.toBeInTheDocument();
  });

  it("renders Listing Changes when app is not tracked", async () => {
    setupDefaultMocks();
    mockGetApp.mockResolvedValue({ ...baseApp, isTrackedByAccount: false });
    mockGetAppCompetitors.mockResolvedValue([]);
    mockGetAppKeywords.mockResolvedValue([]);
    const page = await AppOverviewPage({
      params: Promise.resolve({ platform: "shopify", slug: "form-builder" }),
    });
    render(page);
    expect(screen.getByText("Listing Changes")).toBeInTheDocument();
  });
});
