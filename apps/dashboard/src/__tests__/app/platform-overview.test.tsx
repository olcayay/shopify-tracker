import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  mockUser,
  mockAdminUser,
  mockAccount,
  mockAuthContext,
} from "../test-utils";

// Mock next/navigation with platform param — use vi.fn() so we can override
const mockUseParams = vi.fn().mockReturnValue({ platform: "shopify" });

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/shopify",
  useSearchParams: () => new URLSearchParams(),
  useParams: (...args: any[]) => mockUseParams(...args),
}));

// Mock auth context — use vi.fn() so we can override
const mockFetchWithAuth = vi.fn();
const mockUseAuth = vi.fn().mockReturnValue({
  ...mockAuthContext,
  fetchWithAuth: mockFetchWithAuth,
});

vi.mock("@/lib/auth-context", () => ({
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

// Mock useFormatDate
vi.mock("@/lib/format-date", () => ({
  useFormatDate: () => ({
    formatDateOnly: (d: string) => new Date(d).toLocaleDateString(),
    formatDateTime: (d: string) => new Date(d).toLocaleString(),
  }),
  formatDateOnly: (d: string) => new Date(d).toLocaleDateString(),
  formatDateTime: (d: string) => new Date(d).toLocaleString(),
}));

// Mock components
vi.mock("@/components/app-search-bar", () => ({
  AppSearchBar: () => <div data-testid="app-search-bar">Search</div>,
}));

vi.mock("@/components/skeletons", () => ({
  StatCardSkeleton: () => <div data-testid="stat-skeleton">Loading stat...</div>,
  TableSkeleton: () => <div data-testid="table-skeleton">Loading table...</div>,
}));

vi.mock("@/components/app-badges", () => ({
  AppBadgeIcon: () => null,
}));

import OverviewPage from "@/app/(dashboard)/[platform]/page";

function makeJsonResponse(data: any) {
  return {
    ok: true,
    json: () => Promise.resolve(data),
  };
}

function setupFetchMocks(overrides: Record<string, any> = {}) {
  const apps = overrides.apps ?? [
    { slug: "my-app", name: "My App", iconUrl: null, keywordCount: 5, rankedKeywordCount: 3, competitorCount: 2, lastChangeAt: "2025-01-15" },
  ];
  const keywords = overrides.keywords ?? [
    { id: 1, slug: "email", keyword: "email marketing", latestSnapshot: { totalResults: 250 }, trackedInResults: 1, competitorInResults: 0 },
  ];
  const competitors = overrides.competitors ?? [
    { appSlug: "competitor-1", appName: "Competitor One", iconUrl: null },
  ];
  const features = overrides.features ?? [];
  const categories = overrides.categories ?? [
    { categorySlug: "email", categoryTitle: "Email", appCount: 100, trackedInResults: 1, competitorInResults: 0 },
  ];

  mockFetchWithAuth.mockImplementation((url: string, opts?: any) => {
    if (url === "/api/apps") return Promise.resolve(makeJsonResponse(apps));
    if (url === "/api/keywords") return Promise.resolve(makeJsonResponse(keywords));
    if (url === "/api/account/competitors") return Promise.resolve(makeJsonResponse(competitors));
    if (url === "/api/account/starred-features") return Promise.resolve(makeJsonResponse(features));
    if (url === "/api/account/starred-categories") return Promise.resolve(makeJsonResponse(categories));
    if (url === "/api/system-admin/stats") return Promise.resolve(makeJsonResponse(overrides.systemStats ?? null));
    if (url.startsWith("/api/system-admin/scraper/runs")) return Promise.resolve(makeJsonResponse(overrides.runs ?? []));
    if (url === "/api/apps/categories") return Promise.resolve(makeJsonResponse(overrides.appCategories ?? {}));
    return Promise.resolve(makeJsonResponse(null));
  });
}

describe("OverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ platform: "shopify" });
    mockUseAuth.mockReturnValue({
      ...mockAuthContext,
      fetchWithAuth: mockFetchWithAuth,
    });
  });

  it("renders Overview heading after loading", async () => {
    setupFetchMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Overview")).toBeInTheDocument();
    });
  });

  it("shows loading skeletons initially", () => {
    mockFetchWithAuth.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<OverviewPage />);
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getAllByTestId("stat-skeleton").length).toBeGreaterThan(0);
  });

  it("renders My Apps card with count", async () => {
    setupFetchMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText("My Apps")).toBeInTheDocument();
    });
    expect(screen.getByText("My App")).toBeInTheDocument();
  });

  it("renders Tracked Keywords card", async () => {
    setupFetchMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Tracked Keywords")).toBeInTheDocument();
    });
  });

  it("renders Competitor Apps card", async () => {
    setupFetchMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Competitor Apps")).toBeInTheDocument();
    });
  });

  it("calls fetchWithAuth for all data endpoints", async () => {
    setupFetchMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/apps");
      expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/keywords");
      expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/account/competitors");
      expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/account/starred-categories");
    });
  });

  it("shows 'Coming Soon' for non-enabled platforms", () => {
    mockUseParams.mockReturnValue({ platform: "salesforce" });

    render(<OverviewPage />);
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
  });

  it("renders keyword table with keyword text", async () => {
    setupFetchMocks();
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText("email marketing")).toBeInTheDocument();
    });
  });

  it("shows system stats for admin users", async () => {
    mockUseAuth.mockReturnValue({
      ...mockAuthContext,
      user: mockAdminUser,
      fetchWithAuth: mockFetchWithAuth,
    });

    setupFetchMocks({
      systemStats: {
        accounts: 5,
        users: 10,
        totalApps: 1000,
        trackedApps: 50,
        freshness: [],
      },
      runs: [],
    });

    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText("System Stats")).toBeInTheDocument();
    });
    expect(screen.getByText("Accounts")).toBeInTheDocument();
  });
});
