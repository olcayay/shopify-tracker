import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { mockAccount, mockAuthContext } from "../test-utils";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/competitors",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock auth context
const mockFetchWithAuth = vi.fn();
const mockUseAuth = vi.fn().mockReturnValue({
  ...mockAuthContext,
  account: {
    ...mockAccount,
    enabledPlatforms: ["shopify", "salesforce"],
  },
  fetchWithAuth: mockFetchWithAuth,
});

vi.mock("@/lib/auth-context", () => ({
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

// Mock components
vi.mock("@/components/skeletons", () => ({
  TableSkeleton: ({ rows, cols }: any) => (
    <div data-testid="table-skeleton">
      Loading {rows}x{cols}
    </div>
  ),
}));

vi.mock("@/components/platform-badge-cell", () => ({
  PlatformBadgeCell: ({ platform }: any) => (
    <span data-testid={`platform-badge-${platform}`}>{platform}</span>
  ),
}));

vi.mock("@/components/platform-filter-chips", () => ({
  PlatformFilterChips: ({
    enabledPlatforms,
    activePlatforms,
    onToggle,
  }: any) => (
    <div data-testid="platform-filter-chips">
      {enabledPlatforms.map((p: string) => (
        <button
          key={p}
          data-testid={`chip-${p}`}
          data-active={activePlatforms.includes(p)}
          onClick={() => onToggle(p)}
        >
          {p}
        </button>
      ))}
    </div>
  ),
}));

import CrossPlatformCompetitorsPage from "@/app/(dashboard)/competitors/page";

function makeJsonResponse(data: any) {
  return { ok: true, json: () => Promise.resolve(data) };
}

const mockCompetitorsResponse = {
  items: [
    {
      id: 1,
      platform: "shopify",
      slug: "rival-app",
      name: "Rival App",
      iconUrl: null,
      averageRating: 4.2,
      ratingCount: 300,
      pricingHint: "Free",
      trackedForCount: 2,
      activeInstalls: null,
    },
    {
      id: 2,
      platform: "salesforce",
      slug: "sf-competitor",
      name: "SF Competitor",
      iconUrl: "https://example.com/sf-icon.png",
      averageRating: 3.5,
      ratingCount: 80,
      pricingHint: "$25/mo",
      trackedForCount: 1,
      activeInstalls: 1000,
    },
  ],
  pagination: { page: 1, limit: 25, total: 2, totalPages: 1 },
};

function setupFetchMocks(overrides: { items?: any[]; pagination?: any } = {}) {
  const response = {
    items: overrides.items ?? mockCompetitorsResponse.items,
    pagination: overrides.pagination ?? mockCompetitorsResponse.pagination,
  };
  mockFetchWithAuth.mockImplementation((url: string) => {
    if (url.includes("/api/cross-platform/competitors")) {
      return Promise.resolve(makeJsonResponse(response));
    }
    return Promise.resolve(makeJsonResponse(null));
  });
}

describe("CrossPlatformCompetitorsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      ...mockAuthContext,
      account: {
        ...mockAccount,
        enabledPlatforms: ["shopify", "salesforce"],
      },
      fetchWithAuth: mockFetchWithAuth,
    });
  });

  it("renders page heading", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    expect(screen.getByText("All Competitors")).toBeInTheDocument();
    expect(
      screen.getByText("Competitor apps tracked across all platforms")
    ).toBeInTheDocument();
  });

  it("shows loading skeleton initially", () => {
    mockFetchWithAuth.mockImplementation(() => new Promise(() => {}));
    render(<CrossPlatformCompetitorsPage />);
    expect(screen.getByTestId("table-skeleton")).toBeInTheDocument();
  });

  it("calls fetchWithAuth for cross-platform competitors endpoint", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("/api/cross-platform/competitors")
      );
    });
  });

  it("renders competitor names in the table after loading", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Rival App")).toBeInTheDocument();
      expect(screen.getByText("SF Competitor")).toBeInTheDocument();
    });
  });

  it("renders platform badges for each competitor", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("platform-badge-shopify")).toBeInTheDocument();
      expect(
        screen.getByTestId("platform-badge-salesforce")
      ).toBeInTheDocument();
    });
  });

  it("shows tracked-for count badges", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("2 apps")).toBeInTheDocument();
      expect(screen.getByText("1 app")).toBeInTheDocument();
    });
  });

  it("renders rating and review count", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("4.2")).toBeInTheDocument();
      expect(screen.getByText("300")).toBeInTheDocument();
      expect(screen.getByText("3.5")).toBeInTheDocument();
      expect(screen.getByText("80")).toBeInTheDocument();
    });
  });

  it("renders pricing hints", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Free")).toBeInTheDocument();
      expect(screen.getByText("$25/mo")).toBeInTheDocument();
    });
  });

  it("renders platform filter chips", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    expect(screen.getByTestId("platform-filter-chips")).toBeInTheDocument();
    expect(screen.getByTestId("chip-shopify")).toBeInTheDocument();
    expect(screen.getByTestId("chip-salesforce")).toBeInTheDocument();
  });

  it("renders search input", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    expect(
      screen.getByPlaceholderText("Search competitors...")
    ).toBeInTheDocument();
  });

  it("renders sort buttons in table headers", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Rival App")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /Competitor/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Rating/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Reviews/i })
    ).toBeInTheDocument();
  });

  it("shows empty message when no competitors with search", async () => {
    setupFetchMocks({ items: [] });
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("No competitors tracked.")).toBeInTheDocument();
    });
  });

  it("does not show pagination when only 1 page", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Rival App")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
  });

  it("shows pagination when multiple pages", async () => {
    setupFetchMocks({
      pagination: { page: 1, limit: 25, total: 60, totalPages: 3 },
    });
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(
        screen.getByText("Page 1 of 3 (60 competitors)")
      ).toBeInTheDocument();
    });
  });

  it("clicking platform filter chip triggers data reload", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Rival App")).toBeInTheDocument();
    });
    const callCountBefore = mockFetchWithAuth.mock.calls.length;
    fireEvent.click(screen.getByTestId("chip-shopify"));
    await waitFor(() => {
      expect(mockFetchWithAuth.mock.calls.length).toBeGreaterThan(
        callCountBefore
      );
    });
  });

  it("renders competitor name as link to platform-specific app page", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Rival App")).toBeInTheDocument();
    });
    const link = screen.getByText("Rival App").closest("a");
    expect(link).toHaveAttribute("href", "/shopify/apps/rival-app");
  });

  it("renders competitor icon when iconUrl is provided", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("SF Competitor")).toBeInTheDocument();
    });
    // The icon uses alt="" so we query by tag
    const imgs = document.querySelectorAll("img");
    expect(imgs.length).toBe(1);
    expect(imgs[0].getAttribute("src")).toBe("https://example.com/sf-icon.png");
  });

  it("renders table column headers", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Rival App")).toBeInTheDocument();
    });
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getByText("Tracked For")).toBeInTheDocument();
    expect(screen.getByText("Pricing")).toBeInTheDocument();
  });
});
