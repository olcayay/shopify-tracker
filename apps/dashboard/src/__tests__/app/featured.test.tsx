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
  usePathname: () => "/shopify/featured",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ platform: "shopify" }),
  redirect: vi.fn(),
}));

// Mock API functions
const mockGetFeaturedApps = vi.fn();
const mockGetFeaturedSections = vi.fn();
const mockGetCategories = vi.fn();

vi.mock("@/lib/api", () => ({
  getEnabledFeatures: vi.fn().mockResolvedValue([]),
  getFeaturedApps: (...args: any[]) => mockGetFeaturedApps(...args),
  getFeaturedSections: (...args: any[]) => mockGetFeaturedSections(...args),
  getCategories: (...args: any[]) => mockGetCategories(...args),
}));

// Mock auth-context (needed by FeaturedTabs)
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-1", role: "owner", isSystemAdmin: false },
    account: { enabledPlatforms: ["shopify"] },
    fetchWithAuth: vi.fn(),
  }),
}));

// Mock FeaturedTabs (it's a complex client component)
vi.mock(
  "@/app/(dashboard)/[platform]/featured/featured-tabs",
  () => ({
    FeaturedTabs: ({ homeSightings, sections, categoryOptions }: any) => (
      <div data-testid="featured-tabs">
        <div data-testid="home-sightings-count">{homeSightings.length} home sightings</div>
        <div data-testid="sections-count">{sections.length} sections</div>
        <div data-testid="category-options-count">{categoryOptions.length} category options</div>
      </div>
    ),
  })
);

import FeaturedPage from "@/app/(dashboard)/[platform]/featured/page";

function setupDefaultMocks() {
  mockGetFeaturedApps.mockResolvedValue({
    sightings: [
      { appSlug: "app-1", appName: "App One", sectionHandle: "trending", sectionTitle: "Trending", seenDate: "2025-01-15", iconUrl: null },
      { appSlug: "app-2", appName: "App Two", sectionHandle: "new", sectionTitle: "New & Noteworthy", seenDate: "2025-01-15", iconUrl: null },
    ],
    trackedSlugs: ["app-1"],
    competitorSlugs: [],
  });
  mockGetFeaturedSections.mockResolvedValue([
    { surface: "home", surfaceDetail: null, sectionHandle: "trending", sectionTitle: "Trending", appCount: 10, daysActive: 30, lastSeen: "2025-01-15" },
    { surface: "category", surfaceDetail: "email", sectionHandle: "recommended", sectionTitle: "Recommended", appCount: 5, daysActive: 15, lastSeen: "2025-01-14" },
  ]);
  mockGetCategories.mockResolvedValue([
    { slug: "email", title: "Email", categoryLevel: 0 },
    { slug: "marketing", title: "Marketing", categoryLevel: 0 },
    { slug: "marketing-seo", title: "SEO", categoryLevel: 1 },
  ]);
}

describe("FeaturedPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Featured Apps' heading", async () => {
    setupDefaultMocks();
    const page = await FeaturedPage({
      params: Promise.resolve({ platform: "shopify" }),
    });
    render(page);
    expect(screen.getByText("Featured Apps")).toBeInTheDocument();
  });

  it("renders platform name in description", async () => {
    setupDefaultMocks();
    const page = await FeaturedPage({
      params: Promise.resolve({ platform: "shopify" }),
    });
    render(page);
    expect(screen.getByText(/Shopify App Store/)).toBeInTheDocument();
  });

  it("calls getFeaturedApps with correct params", async () => {
    setupDefaultMocks();
    await FeaturedPage({
      params: Promise.resolve({ platform: "shopify" }),
    });
    expect(mockGetFeaturedApps).toHaveBeenCalledWith(30, "home", undefined, undefined, "shopify");
  });

  it("renders FeaturedTabs with home sightings", async () => {
    setupDefaultMocks();
    const page = await FeaturedPage({
      params: Promise.resolve({ platform: "shopify" }),
    });
    render(page);
    expect(screen.getByTestId("featured-tabs")).toBeInTheDocument();
    expect(screen.getByText("2 home sightings")).toBeInTheDocument();
  });

  it("passes sections data to FeaturedTabs", async () => {
    setupDefaultMocks();
    const page = await FeaturedPage({
      params: Promise.resolve({ platform: "shopify" }),
    });
    render(page);
    expect(screen.getByText("2 sections")).toBeInTheDocument();
  });

  it("computes L0 category options for FeaturedTabs", async () => {
    setupDefaultMocks();
    const page = await FeaturedPage({
      params: Promise.resolve({ platform: "shopify" }),
    });
    render(page);
    // Only "email" L0 category has matching featured data (surfaceDetail: "email")
    expect(screen.getByText("1 category options")).toBeInTheDocument();
  });

  it("handles API errors gracefully", async () => {
    mockGetFeaturedApps.mockRejectedValue(new Error("fail"));
    mockGetFeaturedSections.mockRejectedValue(new Error("fail"));
    mockGetCategories.mockRejectedValue(new Error("fail"));

    // The catch() in the page means it resolves with default empty data
    const page = await FeaturedPage({
      params: Promise.resolve({ platform: "shopify" }),
    });
    render(page);
    expect(screen.getByText("Featured Apps")).toBeInTheDocument();
    expect(screen.getByText("0 home sightings")).toBeInTheDocument();
  });
});
