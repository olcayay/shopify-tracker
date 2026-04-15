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
  usePathname: () => "/keywords",
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

vi.mock("@/contexts/feature-flags-context", () => ({
  useFeatureFlag: () => true,
  useFeatureFlags: () => ({ enabledFeatures: [], hasFeature: () => true }),
}));

// Mock components
vi.mock("@/components/skeletons", () => ({
  TableSkeleton: ({ rows, cols }: any) => (
    <div data-testid="table-skeleton">
      Loading {rows}x{cols}
    </div>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
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

import CrossPlatformKeywordsPage from "@/app/(dashboard)/keywords/page";

function makeJsonResponse(data: any) {
  return { ok: true, json: () => Promise.resolve(data) };
}

const mockKeywordsResponse = {
  items: [
    {
      id: 1,
      platform: "shopify",
      keyword: "email marketing",
      slug: "email-marketing",
      isActive: true,
      appCount: 2,
      trackedApps: [
        { iconUrl: "https://example.com/icon1.png", name: "Klaviyo", slug: "klaviyo", platform: "shopify" },
        { iconUrl: "https://example.com/icon2.png", name: "Mailchimp", slug: "mailchimp", platform: "shopify" },
      ],
      createdAt: "2025-01-01T00:00:00Z",
    },
    {
      id: 2,
      platform: "salesforce",
      keyword: "crm integration",
      slug: "crm-integration",
      isActive: false,
      appCount: 1,
      trackedApps: [
        { iconUrl: null, name: "HubSpot CRM", slug: "hubspot-crm", platform: "salesforce" },
      ],
      createdAt: "2025-02-15T00:00:00Z",
    },
  ],
  pagination: { page: 1, limit: 25, total: 2, totalPages: 1 },
};

function setupFetchMocks(overrides: { items?: any[]; pagination?: any } = {}) {
  const response = {
    items: overrides.items ?? mockKeywordsResponse.items,
    pagination: overrides.pagination ?? mockKeywordsResponse.pagination,
  };
  mockFetchWithAuth.mockImplementation((url: string) => {
    if (url.includes("/api/cross-platform/keywords")) {
      return Promise.resolve(makeJsonResponse(response));
    }
    return Promise.resolve(makeJsonResponse(null));
  });
}

describe("CrossPlatformKeywordsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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
    render(<CrossPlatformKeywordsPage />);
    expect(screen.getByText("All Keywords")).toBeInTheDocument();
    expect(
      screen.getByText("Tracked keywords across all platforms")
    ).toBeInTheDocument();
  });

  it("shows loading skeleton initially", () => {
    mockFetchWithAuth.mockImplementation(() => new Promise(() => {}));
    render(<CrossPlatformKeywordsPage />);
    expect(screen.getByTestId("table-skeleton")).toBeInTheDocument();
  });

  it("calls fetchWithAuth for cross-platform keywords endpoint", async () => {
    setupFetchMocks();
    render(<CrossPlatformKeywordsPage />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("/api/cross-platform/keywords")
      );
    });
  });

  it("renders keyword names in the table after loading", async () => {
    setupFetchMocks();
    render(<CrossPlatformKeywordsPage />);
    await waitFor(() => {
      expect(screen.getByText("email marketing")).toBeInTheDocument();
      expect(screen.getByText("crm integration")).toBeInTheDocument();
    });
  });

  it("renders platform badges for each keyword", async () => {
    setupFetchMocks();
    render(<CrossPlatformKeywordsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("platform-badge-shopify")).toBeInTheDocument();
      expect(
        screen.getByTestId("platform-badge-salesforce")
      ).toBeInTheDocument();
    });
  });

  it("shows active/paused status badges", async () => {
    setupFetchMocks();
    render(<CrossPlatformKeywordsPage />);
    await waitFor(() => {
      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("Paused")).toBeInTheDocument();
    });
  });

  it("renders tracked app icons with links", async () => {
    setupFetchMocks();
    render(<CrossPlatformKeywordsPage />);
    await waitFor(() => {
      expect(screen.getByAltText("Klaviyo")).toBeInTheDocument();
      expect(screen.getByAltText("Mailchimp")).toBeInTheDocument();
    });
    // App icons should link to platform-scoped app detail pages (/{platform}/apps/{slug}).
    // The previous /apps/{platform}/{slug} shape was a bug (PLA-1107): the dashboard
    // middleware rewrote those into /shopify/apps/v1/{platform}/{slug} → 404.
    const klaviyoLink = screen.getByAltText("Klaviyo").closest("a");
    expect(klaviyoLink).toHaveAttribute("href", "/shopify/apps/klaviyo");
    const mailchimpLink = screen.getByAltText("Mailchimp").closest("a");
    expect(mailchimpLink).toHaveAttribute("href", "/shopify/apps/mailchimp");
  });

  it("renders fallback initial for apps without icon", async () => {
    setupFetchMocks();
    render(<CrossPlatformKeywordsPage />);
    await waitFor(() => {
      // HubSpot CRM has no icon, should show "H" initial
      expect(screen.getByText("H")).toBeInTheDocument();
    });
  });

  it("renders platform filter chips", async () => {
    setupFetchMocks();
    render(<CrossPlatformKeywordsPage />);
    expect(screen.getByTestId("platform-filter-chips")).toBeInTheDocument();
    expect(screen.getByTestId("chip-shopify")).toBeInTheDocument();
    expect(screen.getByTestId("chip-salesforce")).toBeInTheDocument();
  });

  it("renders search input", async () => {
    setupFetchMocks();
    render(<CrossPlatformKeywordsPage />);
    expect(
      screen.getByPlaceholderText("Search keywords...")
    ).toBeInTheDocument();
  });

  it("renders sort button in table header", async () => {
    setupFetchMocks();
    render(<CrossPlatformKeywordsPage />);
    await waitFor(() => {
      expect(screen.getByText("email marketing")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /Keyword/i })
    ).toBeInTheDocument();
  });

  it("shows empty message when no keywords found with search", async () => {
    setupFetchMocks({ items: [] });
    render(<CrossPlatformKeywordsPage />);
    await waitFor(() => {
      expect(screen.getByText("No tracked keywords.")).toBeInTheDocument();
    });
  });

  it("does not show pagination when only 1 page", async () => {
    setupFetchMocks();
    render(<CrossPlatformKeywordsPage />);
    await waitFor(() => {
      expect(screen.getByText("email marketing")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
  });

  it("shows pagination when multiple pages", async () => {
    setupFetchMocks({
      pagination: { page: 1, limit: 25, total: 75, totalPages: 3 },
    });
    render(<CrossPlatformKeywordsPage />);
    await waitFor(() => {
      expect(
        screen.getByText("Page 1 of 3 (75 keywords)")
      ).toBeInTheDocument();
    });
  });

  it("clicking platform filter chip triggers data reload", async () => {
    setupFetchMocks();
    render(<CrossPlatformKeywordsPage />);
    await waitFor(() => {
      expect(screen.getByText("email marketing")).toBeInTheDocument();
    });
    const callCountBefore = mockFetchWithAuth.mock.calls.length;
    fireEvent.click(screen.getByTestId("chip-shopify"));
    await waitFor(() => {
      expect(mockFetchWithAuth.mock.calls.length).toBeGreaterThan(
        callCountBefore
      );
    });
  });

  it("renders keyword as link to platform-specific keyword page", async () => {
    setupFetchMocks();
    render(<CrossPlatformKeywordsPage />);
    await waitFor(() => {
      expect(screen.getByText("email marketing")).toBeInTheDocument();
    });
    const link = screen.getByText("email marketing").closest("a");
    expect(link).toHaveAttribute("href", "/shopify/keywords/email-marketing");
  });

  it("renders table column headers", async () => {
    setupFetchMocks();
    render(<CrossPlatformKeywordsPage />);
    await waitFor(() => {
      expect(screen.getByText("email marketing")).toBeInTheDocument();
    });
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tracked Apps/i })).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("sorts by tracked apps when column header is clicked", async () => {
    setupFetchMocks();
    render(<CrossPlatformKeywordsPage />);
    await waitFor(() => {
      expect(screen.getByText("email marketing")).toBeInTheDocument();
    });
    const callCountBefore = mockFetchWithAuth.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /Tracked Apps/i }));
    await waitFor(() => {
      const lastCall = mockFetchWithAuth.mock.calls[mockFetchWithAuth.mock.calls.length - 1][0];
      expect(lastCall).toContain("sort=apps");
    });
  });
});
