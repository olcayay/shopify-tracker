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
  usePathname: () => "/apps",
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
  PlatformFilterChips: ({ enabledPlatforms, activePlatforms, onToggle }: any) => (
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

import CrossPlatformAppsPage from "@/app/(dashboard)/apps/page";

function makeJsonResponse(data: any) {
  return { ok: true, json: () => Promise.resolve(data) };
}

const mockAppsResponse = {
  items: [
    {
      id: 1,
      platform: "shopify",
      slug: "my-app",
      name: "My Shopify App",
      iconUrl: null,
      averageRating: 4.5,
      ratingCount: 120,
      pricingHint: "Free plan available",
      isTracked: true,
      isCompetitor: false,
      activeInstalls: null,
    },
    {
      id: 2,
      platform: "salesforce",
      slug: "sf-app",
      name: "Salesforce Widget",
      iconUrl: "https://example.com/icon.png",
      averageRating: 3.8,
      ratingCount: 45,
      pricingHint: "$10/mo",
      isTracked: false,
      isCompetitor: true,
      activeInstalls: 500,
    },
  ],
  pagination: { page: 1, limit: 25, total: 2, totalPages: 1 },
};

function setupFetchMocks(overrides: { items?: any[]; pagination?: any } = {}) {
  const response = {
    items: overrides.items ?? mockAppsResponse.items,
    pagination: overrides.pagination ?? mockAppsResponse.pagination,
  };
  mockFetchWithAuth.mockImplementation((url: string) => {
    if (url.includes("/api/cross-platform/apps")) {
      return Promise.resolve(makeJsonResponse(response));
    }
    return Promise.resolve(makeJsonResponse(null));
  });
}

describe("CrossPlatformAppsPage", () => {
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
    render(<CrossPlatformAppsPage />);
    expect(screen.getByText("All Apps")).toBeInTheDocument();
    expect(
      screen.getByText("Tracked and competitor apps across all platforms")
    ).toBeInTheDocument();
  });

  it("shows loading skeleton initially", () => {
    mockFetchWithAuth.mockImplementation(() => new Promise(() => {}));
    render(<CrossPlatformAppsPage />);
    expect(screen.getByTestId("table-skeleton")).toBeInTheDocument();
  });

  it("calls fetchWithAuth for cross-platform apps endpoint", async () => {
    setupFetchMocks();
    render(<CrossPlatformAppsPage />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("/api/cross-platform/apps")
      );
    });
  });

  it("renders app names in the table after loading", async () => {
    setupFetchMocks();
    render(<CrossPlatformAppsPage />);
    await waitFor(() => {
      expect(screen.getByText("My Shopify App")).toBeInTheDocument();
      expect(screen.getByText("Salesforce Widget")).toBeInTheDocument();
    });
  });

  it("renders platform badges for each app", async () => {
    setupFetchMocks();
    render(<CrossPlatformAppsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("platform-badge-shopify")).toBeInTheDocument();
      expect(
        screen.getByTestId("platform-badge-salesforce")
      ).toBeInTheDocument();
    });
  });

  it("shows tracked/competitor type badges", async () => {
    setupFetchMocks();
    render(<CrossPlatformAppsPage />);
    await waitFor(() => {
      expect(screen.getByText("Tracked")).toBeInTheDocument();
      expect(screen.getByText("Competitor")).toBeInTheDocument();
    });
  });

  it("renders rating and review count", async () => {
    setupFetchMocks();
    render(<CrossPlatformAppsPage />);
    await waitFor(() => {
      expect(screen.getByText("4.5")).toBeInTheDocument();
      expect(screen.getByText("120")).toBeInTheDocument();
      expect(screen.getByText("3.8")).toBeInTheDocument();
      expect(screen.getByText("45")).toBeInTheDocument();
    });
  });

  it("renders pricing hints", async () => {
    setupFetchMocks();
    render(<CrossPlatformAppsPage />);
    await waitFor(() => {
      expect(screen.getByText("Free plan available")).toBeInTheDocument();
      expect(screen.getByText("$10/mo")).toBeInTheDocument();
    });
  });

  it("renders platform filter chips", async () => {
    setupFetchMocks();
    render(<CrossPlatformAppsPage />);
    expect(screen.getByTestId("platform-filter-chips")).toBeInTheDocument();
    expect(screen.getByTestId("chip-shopify")).toBeInTheDocument();
    expect(screen.getByTestId("chip-salesforce")).toBeInTheDocument();
  });

  it("renders status filter buttons (all, tracked, competitor)", async () => {
    setupFetchMocks();
    render(<CrossPlatformAppsPage />);
    expect(screen.getByRole("button", { name: /^all$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^tracked$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^competitor$/i })
    ).toBeInTheDocument();
  });

  it("renders search input", async () => {
    setupFetchMocks();
    render(<CrossPlatformAppsPage />);
    expect(screen.getByPlaceholderText("Search apps...")).toBeInTheDocument();
  });

  it("renders sort buttons in table headers", async () => {
    setupFetchMocks();
    render(<CrossPlatformAppsPage />);
    await waitFor(() => {
      expect(screen.getByText("My Shopify App")).toBeInTheDocument();
    });
    // Sort buttons: App, Rating, Reviews
    expect(screen.getByRole("button", { name: /App/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Rating/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Reviews/i })
    ).toBeInTheDocument();
  });

  it("shows 'No apps found.' when no items", async () => {
    setupFetchMocks({ items: [] });
    render(<CrossPlatformAppsPage />);
    await waitFor(() => {
      expect(screen.getByText("No apps found.")).toBeInTheDocument();
    });
  });

  it("does not show pagination when only 1 page", async () => {
    setupFetchMocks();
    render(<CrossPlatformAppsPage />);
    await waitFor(() => {
      expect(screen.getByText("My Shopify App")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
  });

  it("shows pagination when multiple pages", async () => {
    setupFetchMocks({
      pagination: { page: 1, limit: 25, total: 50, totalPages: 2 },
    });
    render(<CrossPlatformAppsPage />);
    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2 (50 apps)")).toBeInTheDocument();
    });
  });

  it("clicking platform filter chip triggers data reload", async () => {
    setupFetchMocks();
    render(<CrossPlatformAppsPage />);
    await waitFor(() => {
      expect(screen.getByText("My Shopify App")).toBeInTheDocument();
    });
    const callCountBefore = mockFetchWithAuth.mock.calls.length;
    fireEvent.click(screen.getByTestId("chip-shopify"));
    await waitFor(() => {
      expect(mockFetchWithAuth.mock.calls.length).toBeGreaterThan(
        callCountBefore
      );
    });
  });

  it("filters to only tracked apps client-side when tracked status filter is clicked", async () => {
    setupFetchMocks();
    render(<CrossPlatformAppsPage />);
    await waitFor(() => {
      expect(screen.getByText("My Shopify App")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /^tracked$/i }));
    // Only tracked app should remain visible
    expect(screen.getByText("My Shopify App")).toBeInTheDocument();
    expect(screen.queryByText("Salesforce Widget")).not.toBeInTheDocument();
  });

  it("filters to only competitor apps client-side when competitor status filter is clicked", async () => {
    setupFetchMocks();
    render(<CrossPlatformAppsPage />);
    await waitFor(() => {
      expect(screen.getByText("Salesforce Widget")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /^competitor$/i }));
    expect(screen.queryByText("My Shopify App")).not.toBeInTheDocument();
    expect(screen.getByText("Salesforce Widget")).toBeInTheDocument();
  });

  it("renders app name as link to platform-specific app page", async () => {
    setupFetchMocks();
    render(<CrossPlatformAppsPage />);
    await waitFor(() => {
      expect(screen.getByText("My Shopify App")).toBeInTheDocument();
    });
    const link = screen.getByText("My Shopify App").closest("a");
    expect(link).toHaveAttribute("href", "/shopify/apps/my-app");
  });

  it("renders app icon when iconUrl is provided", async () => {
    setupFetchMocks();
    render(<CrossPlatformAppsPage />);
    await waitFor(() => {
      expect(screen.getByText("Salesforce Widget")).toBeInTheDocument();
    });
    // The icon uses alt="" so we query by tag
    const imgs = document.querySelectorAll("img");
    expect(imgs.length).toBe(1);
    expect(imgs[0].getAttribute("src")).toBe("https://example.com/icon.png");
  });
});
