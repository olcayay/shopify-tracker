import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/navigation with platform and slug params
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/shopify/keywords/test-keyword",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ platform: "shopify", slug: "test-keyword" }),
  redirect: vi.fn(),
}));

// Mock all API functions used by the page
const mockGetKeyword = vi.fn();
const mockGetKeywordRankings = vi.fn();
const mockGetKeywordAds = vi.fn();
const mockGetKeywordSuggestions = vi.fn();
const mockGetKeywordMembership = vi.fn();
const mockGetAccountCompetitors = vi.fn();
const mockGetAccountTrackedApps = vi.fn();
const mockGetAppsLastChanges = vi.fn();
const mockGetAppsMinPaidPrices = vi.fn();
const mockGetAppsReverseSimilarCounts = vi.fn();
const mockGetAppsLaunchedDates = vi.fn();
const mockGetAppsCategories = vi.fn();

vi.mock("@/lib/api", () => ({
  getKeyword: (...args: any[]) => mockGetKeyword(...args),
  getKeywordRankings: (...args: any[]) => mockGetKeywordRankings(...args),
  getKeywordAds: (...args: any[]) => mockGetKeywordAds(...args),
  getKeywordSuggestions: (...args: any[]) => mockGetKeywordSuggestions(...args),
  getKeywordMembership: (...args: any[]) => mockGetKeywordMembership(...args),
  getAccountCompetitors: (...args: any[]) => mockGetAccountCompetitors(...args),
  getAccountTrackedApps: (...args: any[]) => mockGetAccountTrackedApps(...args),
  getAppsLastChanges: (...args: any[]) => mockGetAppsLastChanges(...args),
  getAppsMinPaidPrices: (...args: any[]) => mockGetAppsMinPaidPrices(...args),
  getAppsReverseSimilarCounts: (...args: any[]) => mockGetAppsReverseSimilarCounts(...args),
  getAppsLaunchedDates: (...args: any[]) => mockGetAppsLaunchedDates(...args),
  getAppsCategories: (...args: any[]) => mockGetAppsCategories(...args),
}));

// Mock child components that are complex
vi.mock("@/components/ranking-chart", () => ({
  RankingChart: ({ data }: any) => (
    <div data-testid="ranking-chart">Ranking Chart ({data.length} points)</div>
  ),
}));

vi.mock("@/components/ad-heatmap", () => ({
  AdHeatmap: () => <div data-testid="ad-heatmap">Ad Heatmap</div>,
}));

vi.mock("@/components/live-search-trigger", () => ({
  LiveSearchTrigger: ({ keyword }: any) => (
    <button data-testid="live-search-trigger">Live Search: {keyword}</button>
  ),
}));

vi.mock("@/components/admin-scraper-trigger", () => ({
  AdminScraperTrigger: ({ label }: any) => (
    <button data-testid="admin-scraper-trigger">{label}</button>
  ),
}));

vi.mock("@/components/keyword-suggestions-trigger", () => ({
  KeywordSuggestionsTrigger: () => (
    <button data-testid="keyword-suggestions-trigger">Suggestions</button>
  ),
}));

vi.mock("@/components/competitor-button", () => ({
  CompetitorButton: ({ appSlug }: any) => (
    <button data-testid={`star-app-${appSlug}`}>Star</button>
  ),
}));

// Mock sub-page components
const mockTrackKeywordButton = vi.fn();
vi.mock(
  "@/app/(dashboard)/[platform]/keywords/[slug]/track-button",
  () => ({
    TrackKeywordButton: (props: any) => {
      mockTrackKeywordButton(props);
      return (
        <button data-testid="track-keyword-button">
          {props.initialTracked ? "Untrack" : "Track"}
        </button>
      );
    },
  })
);

vi.mock(
  "@/app/(dashboard)/[platform]/keywords/[slug]/app-results",
  () => ({
    KeywordAppResults: ({ apps }: any) => (
      <div data-testid="keyword-app-results">
        {apps.length} organic results
      </div>
    ),
  })
);

vi.mock(
  "@/app/(dashboard)/[platform]/keywords/[slug]/pending-poller",
  () => ({
    KeywordPendingPoller: () => (
      <div data-testid="keyword-pending-poller">Pending...</div>
    ),
  })
);

import KeywordDetailPage from "@/app/(dashboard)/[platform]/keywords/[slug]/page";

function buildKeywordData(overrides: any = {}) {
  return {
    id: 1,
    keyword: "email marketing",
    slug: "email-marketing",
    isTrackedByAccount: true,
    trackedForApps: ["my-app"],
    positionChanges: {},
    latestSnapshot: {
      totalResults: 250,
      scrapedAt: "2025-01-15T12:00:00Z",
      results: [
        {
          app_slug: "app-1",
          app_name: "App One",
          average_rating: 4.5,
          rating_count: 100,
          logo_url: null,
          is_sponsored: false,
          is_built_in: false,
          is_built_for_shopify: true,
        },
        {
          app_slug: "app-2",
          app_name: "App Two",
          average_rating: 4.0,
          rating_count: 50,
          logo_url: null,
          is_sponsored: true,
          is_built_in: false,
          is_built_for_shopify: false,
        },
      ],
    },
    ...overrides,
  };
}

function setupDefaultMocks(keywordOverrides: any = {}) {
  const keywordData = buildKeywordData(keywordOverrides);
  mockGetKeyword.mockResolvedValue(keywordData);
  mockGetKeywordRankings.mockResolvedValue({ rankings: [] });
  mockGetKeywordAds.mockResolvedValue({ adSightings: [] });
  mockGetKeywordSuggestions.mockResolvedValue({ suggestions: [], scrapedAt: null });
  mockGetKeywordMembership.mockResolvedValue({ trackedAppNames: [], researchProjects: [] });
  mockGetAccountCompetitors.mockResolvedValue([]);
  mockGetAccountTrackedApps.mockResolvedValue([]);
  mockGetAppsLastChanges.mockResolvedValue({});
  mockGetAppsMinPaidPrices.mockResolvedValue({});
  mockGetAppsReverseSimilarCounts.mockResolvedValue({});
  mockGetAppsLaunchedDates.mockResolvedValue({});
  mockGetAppsCategories.mockResolvedValue({});
  return keywordData;
}

describe("KeywordDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders keyword name in heading", async () => {
    setupDefaultMocks();
    const page = await KeywordDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email-marketing" }),
    });
    render(page);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("email marketing");
  });

  it("shows total results count", async () => {
    setupDefaultMocks();
    const page = await KeywordDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email-marketing" }),
    });
    render(page);
    expect(screen.getByText(/250 total results/)).toBeInTheDocument();
  });

  it("shows 'Keyword not found.' when API throws", async () => {
    mockGetKeyword.mockRejectedValue(new Error("Not found"));
    mockGetKeywordRankings.mockRejectedValue(new Error("Not found"));
    mockGetKeywordAds.mockRejectedValue(new Error("Not found"));
    mockGetKeywordSuggestions.mockResolvedValue({ suggestions: [], scrapedAt: null });
    mockGetKeywordMembership.mockResolvedValue({});
    mockGetAccountCompetitors.mockResolvedValue([]);
    mockGetAccountTrackedApps.mockResolvedValue([]);

    const page = await KeywordDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "nonexistent" }),
    });
    render(page);
    expect(screen.getByText("Keyword not found.")).toBeInTheDocument();
  });

  it("calls getKeyword with correct slug and platform", async () => {
    setupDefaultMocks();
    await KeywordDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email-marketing" }),
    });
    expect(mockGetKeyword).toHaveBeenCalledWith("email-marketing", "shopify");
  });

  it("renders organic app results section", async () => {
    setupDefaultMocks();
    const page = await KeywordDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email-marketing" }),
    });
    render(page);
    expect(screen.getByTestId("keyword-app-results")).toBeInTheDocument();
    expect(screen.getByText(/1 organic results/)).toBeInTheDocument();
  });

  it("renders sponsored apps section when present", async () => {
    setupDefaultMocks();
    const page = await KeywordDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email-marketing" }),
    });
    render(page);
    expect(screen.getByText(/Sponsored Apps \(1\)/)).toBeInTheDocument();
    expect(screen.getByText("App Two")).toBeInTheDocument();
  });

  it("shows 'tracked for' apps via keyword membership", async () => {
    mockGetKeyword.mockResolvedValue(buildKeywordData());
    mockGetKeywordRankings.mockResolvedValue({ rankings: [] });
    mockGetKeywordAds.mockResolvedValue({ adSightings: [] });
    mockGetKeywordSuggestions.mockResolvedValue({ suggestions: [], scrapedAt: null });
    mockGetKeywordMembership.mockResolvedValue({
      trackedAppNames: [{ slug: "my-app", name: "My App" }],
      researchProjects: [],
    });
    mockGetAccountCompetitors.mockResolvedValue([]);
    mockGetAccountTrackedApps.mockResolvedValue([]);
    mockGetAppsLastChanges.mockResolvedValue({});
    mockGetAppsMinPaidPrices.mockResolvedValue({});
    mockGetAppsReverseSimilarCounts.mockResolvedValue({});
    mockGetAppsLaunchedDates.mockResolvedValue({});
    mockGetAppsCategories.mockResolvedValue({});

    const page = await KeywordDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email-marketing" }),
    });
    render(page);
    expect(screen.getByText("Tracked for My App")).toBeInTheDocument();
  });

  it("renders ranking chart when ranking data exists", async () => {
    mockGetKeyword.mockResolvedValue(buildKeywordData());
    mockGetKeywordRankings.mockResolvedValue({
      rankings: [
        { scrapedAt: "2025-01-15", position: 3, appName: "App One", appSlug: "app-1", iconUrl: null },
        { scrapedAt: "2025-01-14", position: 5, appName: "App One", appSlug: "app-1", iconUrl: null },
      ],
    });
    mockGetKeywordAds.mockResolvedValue({ adSightings: [] });
    mockGetKeywordSuggestions.mockResolvedValue({ suggestions: [], scrapedAt: null });
    mockGetKeywordMembership.mockResolvedValue({ trackedAppNames: [], researchProjects: [] });
    mockGetAccountCompetitors.mockResolvedValue([]);
    mockGetAccountTrackedApps.mockResolvedValue([]);
    mockGetAppsLastChanges.mockResolvedValue({});
    mockGetAppsMinPaidPrices.mockResolvedValue({});
    mockGetAppsReverseSimilarCounts.mockResolvedValue({});
    mockGetAppsLaunchedDates.mockResolvedValue({});
    mockGetAppsCategories.mockResolvedValue({});

    const page = await KeywordDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email-marketing" }),
    });
    render(page);
    expect(screen.getByText("Organic Ranking History")).toBeInTheDocument();
    expect(screen.getByTestId("ranking-chart")).toBeInTheDocument();
  });

  it("renders the track keyword button", async () => {
    setupDefaultMocks();
    const page = await KeywordDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email-marketing" }),
    });
    render(page);
    expect(screen.getByTestId("track-keyword-button")).toBeInTheDocument();
  });

  it("shows pending poller when snapshot is null", async () => {
    setupDefaultMocks({ latestSnapshot: null });
    const page = await KeywordDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email-marketing" }),
    });
    render(page);
    expect(screen.getByTestId("keyword-pending-poller")).toBeInTheDocument();
  });

  it("shows built-in apps section when present", async () => {
    setupDefaultMocks({
      latestSnapshot: {
        totalResults: 100,
        scrapedAt: "2025-01-15T12:00:00Z",
        results: [
          {
            app_slug: "bif:shopify-inbox",
            app_name: "Shopify Inbox",
            is_built_in: true,
            is_sponsored: false,
            logo_url: null,
            short_description: "Chat with customers",
          },
        ],
      },
    });
    const page = await KeywordDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email-marketing" }),
    });
    render(page);
    expect(screen.getByText(/Shopify Built-in/)).toBeInTheDocument();
    expect(screen.getByText("Shopify Inbox")).toBeInTheDocument();
  });
});
