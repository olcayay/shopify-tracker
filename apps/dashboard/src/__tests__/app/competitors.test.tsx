import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  mockUser,
  mockViewerUser,
  mockAccount,
  mockAuthContext,
} from "../test-utils";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/shopify/competitors",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ platform: "shopify" }),
}));

// Mock auth context - use vi.fn() for overriding
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
vi.mock("@/components/skeletons", () => ({
  TableSkeleton: () => <div data-testid="table-skeleton">Loading table...</div>,
}));

vi.mock("@/components/admin-scraper-trigger", () => ({
  AdminScraperTrigger: ({ label }: any) => (
    <button data-testid="admin-scraper-trigger">{label}</button>
  ),
}));

vi.mock("@/components/app-search-bar", () => ({
  AppSearchBar: () => <div data-testid="app-search-bar">Search</div>,
}));

vi.mock("@/components/confirm-modal", () => ({
  ConfirmModal: ({ open, title }: any) =>
    open ? <div data-testid="confirm-modal">{title}</div> : null,
}));

vi.mock("@/components/velocity-cell", () => ({
  VelocityCell: ({ value }: any) => <span>{value ?? "\u2014"}</span>,
}));

vi.mock("@/components/momentum-badge", () => ({
  MomentumBadge: ({ momentum }: any) => <span>{momentum ?? "\u2014"}</span>,
}));

vi.mock("@/components/visibility-score-popover", () => ({
  VisibilityScorePopover: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/power-score-popover", () => ({
  WeightedPowerPopover: ({ children }: any) => <>{children}</>,
}));

import CompetitorsPage from "@/app/(dashboard)/[platform]/competitors/page";

function makeJsonResponse(data: any) {
  return {
    ok: true,
    json: () => Promise.resolve(data),
  };
}

function setupFetchMocks(overrides: Record<string, any> = {}) {
  const competitors = overrides.competitors ?? [
    {
      appSlug: "comp-1",
      appName: "Competitor One",
      iconUrl: null,
      trackedAppSlug: "my-app",
      latestSnapshot: { averageRating: 4.5, ratingCount: 200, pricing: "Free plan available" },
      isBuiltForShopify: true,
      lastChangeAt: "2025-01-10",
    },
    {
      appSlug: "comp-2",
      appName: "Competitor Two",
      iconUrl: null,
      trackedAppSlug: "my-app",
      latestSnapshot: { averageRating: 3.8, ratingCount: 50 },
      isBuiltForShopify: false,
      lastChangeAt: null,
    },
  ];
  const myApps = overrides.myApps ?? [
    {
      appSlug: "my-app",
      appName: "My App",
      iconUrl: null,
    },
  ];

  mockFetchWithAuth.mockImplementation((url: string) => {
    if (url === "/api/account/competitors")
      return Promise.resolve(makeJsonResponse(competitors));
    if (url === "/api/account/tracked-apps")
      return Promise.resolve(makeJsonResponse(myApps));
    return Promise.resolve(makeJsonResponse(null));
  });
}

describe("CompetitorsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      ...mockAuthContext,
      fetchWithAuth: mockFetchWithAuth,
    });
  });

  it("renders 'Competitor Apps' heading after loading", async () => {
    setupFetchMocks();
    render(<CompetitorsPage />);
    await waitFor(() => {
      expect(
        screen.getByText(/Competitor Apps/)
      ).toBeInTheDocument();
    });
  });

  it("shows loading skeleton initially", () => {
    mockFetchWithAuth.mockImplementation(() => new Promise(() => {}));
    render(<CompetitorsPage />);
    expect(screen.getByTestId("table-skeleton")).toBeInTheDocument();
  });

  it("calls fetchWithAuth for competitors and tracked apps", async () => {
    setupFetchMocks();
    render(<CompetitorsPage />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/account/competitors");
      expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/account/tracked-apps");
    });
  });

  it("renders competitor names in the table", async () => {
    setupFetchMocks();
    render(<CompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Competitor One")).toBeInTheDocument();
      expect(screen.getByText("Competitor Two")).toBeInTheDocument();
    });
  });

  it("groups competitors by tracked app", async () => {
    setupFetchMocks();
    render(<CompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("My App")).toBeInTheDocument();
      expect(screen.getByText(/2 competitors/)).toBeInTheDocument();
    });
  });

  it("shows remove button for editor/owner users", async () => {
    setupFetchMocks();
    render(<CompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Competitor One")).toBeInTheDocument();
    });
    // Owner role (default) should see remove buttons (X icons in the last column)
    // Look for buttons with the hover:text-destructive class
    const allButtons = screen.getAllByRole("button");
    const removeButtons = allButtons.filter(
      (btn) => btn.className.includes("hover:text-destructive")
    );
    expect(removeButtons.length).toBe(2); // One per competitor
  });

  it("hides remove button for viewer users", async () => {
    mockUseAuth.mockReturnValue({
      ...mockAuthContext,
      user: mockViewerUser,
      fetchWithAuth: mockFetchWithAuth,
    });

    setupFetchMocks();
    render(<CompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Competitor One")).toBeInTheDocument();
    });
    // Viewer should NOT see the remove (X) buttons
    const allButtons = screen.getAllByRole("button");
    const removeButtons = allButtons.filter(
      (btn) => btn.className.includes("hover:text-destructive")
    );
    expect(removeButtons.length).toBe(0);
  });

  it("shows 'No tracked apps yet' when there are no tracked apps", async () => {
    setupFetchMocks({ competitors: [], myApps: [] });
    render(<CompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText(/No tracked apps yet/)).toBeInTheDocument();
    });
  });

  it("wraps table in overflow-x-auto container for horizontal scrolling", async () => {
    setupFetchMocks();
    const { container } = render(<CompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Competitor One")).toBeInTheDocument();
    });
    // The table's parent CardContent should have overflow-x-auto
    const table = container.querySelector("table");
    expect(table).toBeTruthy();
    const cardContent = table!.closest(".overflow-x-auto");
    expect(cardContent).toBeTruthy();
  });

  it("shows 'Apps without competitors' section when some apps have no competitors", async () => {
    setupFetchMocks({
      competitors: [],
      myApps: [{ appSlug: "my-app", appName: "My App", iconUrl: null }],
    });
    render(<CompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Apps without competitors")).toBeInTheDocument();
    });
  });
});
