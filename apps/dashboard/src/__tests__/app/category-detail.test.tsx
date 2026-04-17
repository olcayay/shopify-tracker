import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/shopify/categories/email",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ platform: "shopify", slug: "email" }),
  redirect: vi.fn(),
}));

// Mock all API functions
const mockGetCategory = vi.fn();
const mockGetCategoryHistory = vi.fn();
const mockGetAccountCompetitors = vi.fn();
const mockGetAccountTrackedApps = vi.fn();
const mockGetAccountStarredCategories = vi.fn();
const mockGetAppsLastChanges = vi.fn();
const mockGetAppsMinPaidPrices = vi.fn();
const mockGetAppsReverseSimilarCounts = vi.fn();
const mockGetFeaturedApps = vi.fn();
const mockGetCategoryAds = vi.fn();
const mockGetCategoryScores = vi.fn();

vi.mock("@/lib/api", () => ({
  getEnabledFeatures: vi.fn().mockResolvedValue([]),
  getCategory: (...args: any[]) => mockGetCategory(...args),
  getCategoryHistory: (...args: any[]) => mockGetCategoryHistory(...args),
  getAccountCompetitors: (...args: any[]) => mockGetAccountCompetitors(...args),
  getAccountTrackedApps: (...args: any[]) => mockGetAccountTrackedApps(...args),
  getAccountStarredCategories: (...args: any[]) => mockGetAccountStarredCategories(...args),
  getAppsLastChanges: (...args: any[]) => mockGetAppsLastChanges(...args),
  getAppsMinPaidPrices: (...args: any[]) => mockGetAppsMinPaidPrices(...args),
  getAppsReverseSimilarCounts: (...args: any[]) => mockGetAppsReverseSimilarCounts(...args),
  getFeaturedApps: (...args: any[]) => mockGetFeaturedApps(...args),
  getCategoryAds: (...args: any[]) => mockGetCategoryAds(...args),
  getCategoryScores: (...args: any[]) => mockGetCategoryScores(...args),
}));

// Mock child components
vi.mock("@/components/bookmark-category-button", () => ({
  BookmarkCategoryButton: ({ categorySlug, initialStarred }: any) => (
    <button data-testid="star-category-button">
      {initialStarred ? "Unstar" : "Star"} {categorySlug}
    </button>
  ),
}));

vi.mock("@/components/admin-scraper-trigger", () => ({
  AdminScraperTrigger: ({ label }: any) => (
    <button data-testid="admin-scraper-trigger">{label}</button>
  ),
}));

vi.mock("@/components/ad-heatmap", () => ({
  AdHeatmap: () => <div data-testid="ad-heatmap">Ad Heatmap</div>,
}));

vi.mock("@/lib/score-features-server", () => ({
  hasServerFeature: vi.fn().mockResolvedValue(true),
}));

vi.mock(
  "@/app/(dashboard)/[platform]/categories/[slug]/app-results",
  () => ({
    CategoryAppResults: ({ apps }: any) => (
      <div data-testid="category-app-results">
        {apps.length} ranked apps
      </div>
    ),
  })
);

import CategoryDetailPage from "@/app/(dashboard)/[platform]/categories/[slug]/page";

function buildCategoryData(overrides: any = {}) {
  return {
    slug: "email",
    title: "Email Marketing",
    description: "Apps for email marketing",
    isListingPage: true,
    breadcrumb: [
      { slug: "marketing", title: "Marketing" },
      { slug: "email", title: "Email Marketing" },
    ],
    children: [],
    rankedApps: [
      {
        slug: "app-1",
        name: "App One",
        position: 1,
        icon_url: null,
        average_rating: 4.8,
        rating_count: 500,
        pricing_hint: "Free plan available",
        is_built_for_shopify: true,
        launched_date: null,
        source_categories: [],
      },
      {
        slug: "app-2",
        name: "App Two",
        position: 2,
        icon_url: null,
        average_rating: 4.2,
        rating_count: 200,
        pricing_hint: "From $9.99/month",
        is_built_for_shopify: false,
        launched_date: null,
        source_categories: [],
      },
    ],
    allParentPaths: null,
    ...overrides,
  };
}

function setupDefaultMocks(categoryOverrides: any = {}) {
  const categoryData = buildCategoryData(categoryOverrides);
  mockGetCategory.mockResolvedValue(categoryData);
  mockGetCategoryHistory.mockResolvedValue({ snapshots: [], total: 0 });
  mockGetAccountCompetitors.mockResolvedValue([]);
  mockGetAccountTrackedApps.mockResolvedValue([]);
  mockGetAccountStarredCategories.mockResolvedValue([]);
  mockGetAppsLastChanges.mockResolvedValue({});
  mockGetAppsMinPaidPrices.mockResolvedValue({});
  mockGetAppsReverseSimilarCounts.mockResolvedValue({});
  mockGetFeaturedApps.mockResolvedValue({ sightings: [], trackedSlugs: [], competitorSlugs: [] });
  mockGetCategoryAds.mockResolvedValue({ adSightings: [] });
  mockGetCategoryScores.mockResolvedValue({ scores: [], computedAt: null });
  return categoryData;
}

describe("CategoryDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders category title in heading", async () => {
    setupDefaultMocks();
    const page = await CategoryDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email" }),
    });
    render(page);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Email Marketing");
  });

  it("renders category description", async () => {
    setupDefaultMocks();
    const page = await CategoryDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email" }),
    });
    render(page);
    expect(screen.getByText("Apps for email marketing")).toBeInTheDocument();
  });

  it("shows 'Category not indexed yet' when API throws", async () => {
    mockGetCategory.mockRejectedValue(new Error("Not found"));
    mockGetCategoryHistory.mockRejectedValue(new Error("Not found"));
    mockGetAccountCompetitors.mockResolvedValue([]);
    mockGetAccountTrackedApps.mockResolvedValue([]);
    mockGetAccountStarredCategories.mockResolvedValue([]);

    const page = await CategoryDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "nonexistent" }),
    });
    render(page);
    expect(screen.getByText("Category not indexed yet")).toBeInTheDocument();
  });

  it("calls getCategory with correct slug and platform", async () => {
    setupDefaultMocks();
    await CategoryDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email" }),
    });
    expect(mockGetCategory).toHaveBeenCalledWith("email", "shopify");
  });

  it("renders ranked apps via CategoryAppResults", async () => {
    setupDefaultMocks();
    const page = await CategoryDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email" }),
    });
    render(page);
    expect(screen.getByTestId("category-app-results")).toBeInTheDocument();
    expect(screen.getByText("2 ranked apps")).toBeInTheDocument();
  });

  it("renders breadcrumb navigation", async () => {
    setupDefaultMocks();
    const page = await CategoryDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email" }),
    });
    render(page);
    expect(screen.getByText("Marketing")).toBeInTheDocument();
  });

  it("shows subcategories when children exist", async () => {
    setupDefaultMocks({
      children: [
        { slug: "email-newsletters", title: "Newsletters", appCount: 25 },
        { slug: "email-automation", title: "Automation", appCount: 15 },
      ],
    });
    const page = await CategoryDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email" }),
    });
    render(page);
    expect(screen.getByText(/Subcategories \(2\)/)).toBeInTheDocument();
    expect(screen.getByText("Newsletters (25)")).toBeInTheDocument();
    expect(screen.getByText("Automation (15)")).toBeInTheDocument();
  });

  it("renders the star category button", async () => {
    setupDefaultMocks();
    const page = await CategoryDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email" }),
    });
    render(page);
    expect(screen.getByTestId("star-category-button")).toBeInTheDocument();
  });

  it("shows star category button with initial starred state", async () => {
    mockGetCategory.mockResolvedValue(buildCategoryData());
    mockGetCategoryHistory.mockResolvedValue({ snapshots: [], total: 0 });
    mockGetAccountCompetitors.mockResolvedValue([]);
    mockGetAccountTrackedApps.mockResolvedValue([]);
    mockGetAccountStarredCategories.mockResolvedValue([
      { categorySlug: "email" },
    ]);
    mockGetAppsLastChanges.mockResolvedValue({});
    mockGetAppsMinPaidPrices.mockResolvedValue({});
    mockGetAppsReverseSimilarCounts.mockResolvedValue({});
    mockGetFeaturedApps.mockResolvedValue({ sightings: [], trackedSlugs: [], competitorSlugs: [] });
    mockGetCategoryAds.mockResolvedValue({ adSightings: [] });
    mockGetCategoryScores.mockResolvedValue({ scores: [], computedAt: null });

    const page = await CategoryDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email" }),
    });
    render(page);
    expect(screen.getByText(/Unstar email/)).toBeInTheDocument();
  });

  it("renders history table when snapshots exist", async () => {
    mockGetCategory.mockResolvedValue(buildCategoryData());
    mockGetCategoryHistory.mockResolvedValue({
      snapshots: [
        { id: 1, scrapedAt: "2025-01-15T12:00:00Z", appCount: 100 },
        { id: 2, scrapedAt: "2025-01-14T12:00:00Z", appCount: 98 },
      ],
      total: 2,
    });
    mockGetAccountCompetitors.mockResolvedValue([]);
    mockGetAccountTrackedApps.mockResolvedValue([]);
    mockGetAccountStarredCategories.mockResolvedValue([]);
    mockGetAppsLastChanges.mockResolvedValue({});
    mockGetAppsMinPaidPrices.mockResolvedValue({});
    mockGetAppsReverseSimilarCounts.mockResolvedValue({});
    mockGetFeaturedApps.mockResolvedValue({ sightings: [], trackedSlugs: [], competitorSlugs: [] });
    mockGetCategoryAds.mockResolvedValue({ adSightings: [] });
    mockGetCategoryScores.mockResolvedValue({ scores: [], computedAt: null });

    const page = await CategoryDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "email" }),
    });
    render(page);
    expect(screen.getByText("History (2 snapshots)")).toBeInTheDocument();
  });

  it("shows 'Temporarily unavailable' when getCategory throws a transient error", async () => {
    mockGetCategory.mockRejectedValue(
      new Error("Service temporarily unavailable. Please try again in a moment.")
    );
    mockGetCategoryHistory.mockRejectedValue(new Error("Service temporarily unavailable"));
    mockGetAccountCompetitors.mockResolvedValue([]);
    mockGetAccountTrackedApps.mockResolvedValue([]);
    mockGetAccountStarredCategories.mockResolvedValue([]);

    const page = await CategoryDetailPage({
      params: Promise.resolve({ platform: "salesforce", slug: "dataManagement" }),
    });
    render(page);
    expect(screen.getByText("Temporarily unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Category not indexed yet")).not.toBeInTheDocument();
  });

  it("shows 'Category not indexed yet' when getCategory 404s", async () => {
    mockGetCategory.mockRejectedValue(new Error("API error: 404"));
    mockGetCategoryHistory.mockRejectedValue(new Error("Not found"));
    mockGetAccountCompetitors.mockResolvedValue([]);
    mockGetAccountTrackedApps.mockResolvedValue([]);
    mockGetAccountStarredCategories.mockResolvedValue([]);

    const page = await CategoryDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "nope" }),
    });
    render(page);
    expect(screen.getByText("Category not indexed yet")).toBeInTheDocument();
    expect(screen.queryByText("Temporarily unavailable")).not.toBeInTheDocument();
  });

  it("shows 'Browse all categories' link when category not found", async () => {
    mockGetCategory.mockRejectedValue(new Error("Not found"));
    mockGetCategoryHistory.mockRejectedValue(new Error("Not found"));
    mockGetAccountCompetitors.mockResolvedValue([]);
    mockGetAccountTrackedApps.mockResolvedValue([]);
    mockGetAccountStarredCategories.mockResolvedValue([]);

    const page = await CategoryDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "nonexistent" }),
    });
    render(page);
    expect(screen.getByText("Browse all categories")).toBeInTheDocument();
  });
});
