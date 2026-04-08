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

vi.mock("@/components/platform-badge-cell", () => ({
  PlatformBadgeCell: ({ platform }: any) => (
    <span data-testid={`platform-badge-${platform}`}>{platform}</span>
  ),
}));

vi.mock("@/lib/platform-display", () => ({
  PLATFORM_DISPLAY: {
    shopify: { label: "Shopify", shortLabel: "Shopify", color: "#95BF47", gradient: "", borderTop: "", textAccent: "" },
    salesforce: { label: "Salesforce", shortLabel: "Salesforce", color: "#00A1E0", gradient: "", borderTop: "", textAccent: "" },
  },
  getPlatformColor: (p: string) => (p === "shopify" ? "#95BF47" : "#00A1E0"),
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

import CrossPlatformCompetitorsPage, { groupCompetitorsByApp } from "@/app/(dashboard)/competitors/page";

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
      trackedForApps: [
        { id: 10, name: "My App", iconUrl: "https://example.com/my-app.png", slug: "my-app", platform: "shopify" },
        { id: 11, name: "Other App", iconUrl: null, slug: "other-app", platform: "shopify" },
      ],
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
      trackedForApps: [
        { id: 12, name: "SF Tracked", iconUrl: null, slug: "sf-tracked", platform: "salesforce" },
      ],
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

  it("shows tracked-for app names and logos instead of count", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      // Tracked app names should be visible
      expect(screen.getByText("My App")).toBeInTheDocument();
      expect(screen.getByText("Other App")).toBeInTheDocument();
      expect(screen.getByText("SF Tracked")).toBeInTheDocument();
    });

    // Tracked app names should link to their detail pages
    const myAppLink = screen.getByText("My App").closest("a");
    expect(myAppLink).toHaveAttribute("href", "/shopify/apps/my-app");
    const sfTrackedLink = screen.getByText("SF Tracked").closest("a");
    expect(sfTrackedLink).toHaveAttribute("href", "/salesforce/apps/sf-tracked");
  });

  it("shows tracked app icon when iconUrl is provided", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("My App")).toBeInTheDocument();
    });

    // My App has an icon, Other App does not
    const myAppContainer = screen.getByText("My App").closest("a")!;
    const myAppImg = myAppContainer.querySelector("img");
    expect(myAppImg).toBeTruthy();
    expect(myAppImg!.getAttribute("src")).toBe("https://example.com/my-app.png");

    const otherAppContainer = screen.getByText("Other App").closest("a")!;
    const otherAppImg = otherAppContainer.querySelector("img");
    expect(otherAppImg).toBeNull();
  });

  it("falls back to count badge when trackedForApps is empty", async () => {
    setupFetchMocks({
      items: [
        {
          id: 3,
          platform: "shopify",
          slug: "old-competitor",
          name: "Old Competitor",
          iconUrl: null,
          averageRating: 2.0,
          ratingCount: 10,
          pricingHint: null,
          trackedForCount: 3,
          trackedForApps: [],
          activeInstalls: null,
        },
      ],
    });
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("3 apps")).toBeInTheDocument();
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
      screen.getByPlaceholderText("Filter competitors...")
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
    // SF Competitor has an icon in the name column
    const sfLink = screen.getByText("SF Competitor").closest("a")!;
    const sfImg = sfLink.querySelector("img");
    expect(sfImg).toBeTruthy();
    expect(sfImg!.getAttribute("src")).toBe("https://example.com/sf-icon.png");
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

  it("renders List and By Platform toggle buttons", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    expect(screen.getByRole("button", { name: /List/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /By Platform/i })).toBeInTheDocument();
  });

  it("groups competitors by platform when By Platform is clicked", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Rival App")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /By Platform/i }));

    await waitFor(() => {
      // Platform group headers should appear
      expect(screen.getByText("Shopify")).toBeInTheDocument();
      expect(screen.getByText("Salesforce")).toBeInTheDocument();
      // Competitors should still be visible
      expect(screen.getByText("Rival App")).toBeInTheDocument();
      expect(screen.getByText("SF Competitor")).toBeInTheDocument();
    });
  });

  it("shows competitor count per platform group", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Rival App")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /By Platform/i }));

    await waitFor(() => {
      const countBadges = screen.getAllByText("(1 competitor)");
      expect(countBadges).toHaveLength(2); // one per platform group
    });
  });

  it("hides Platform column in grouped view", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Rival App")).toBeInTheDocument();
    });

    // In flat view, Platform column exists
    expect(screen.getByText("Platform")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /By Platform/i }));

    await waitFor(() => {
      expect(screen.getByText("Shopify")).toBeInTheDocument();
    });

    // In grouped view, no Platform column header
    expect(screen.queryByText("Platform")).not.toBeInTheDocument();
  });

  it("switches back to flat list view", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Rival App")).toBeInTheDocument();
    });

    // Switch to grouped
    fireEvent.click(screen.getByRole("button", { name: /By Platform/i }));
    await waitFor(() => {
      expect(screen.getByText("Shopify")).toBeInTheDocument();
    });

    // Switch back to list
    fireEvent.click(screen.getByRole("button", { name: /List/i }));
    await waitFor(() => {
      expect(screen.getByText("Platform")).toBeInTheDocument();
      expect(screen.queryByText("(1 competitor)")).not.toBeInTheDocument();
    });
  });

  it("shows empty message in grouped view when no competitors", async () => {
    setupFetchMocks({ items: [] });
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("No competitors tracked.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /By Platform/i }));

    await waitFor(() => {
      expect(screen.getByText("No competitors tracked.")).toBeInTheDocument();
    });
  });

  // --- By App view mode tests ---

  it("renders By App toggle button", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    expect(screen.getByRole("button", { name: /By App/i })).toBeInTheDocument();
  });

  it("groups competitors by tracked app when By App is clicked", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Rival App")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /By App/i }));

    await waitFor(() => {
      // App group headers should appear with tracked app names
      expect(screen.getByText("My App")).toBeInTheDocument();
      expect(screen.getByText("Other App")).toBeInTheDocument();
      expect(screen.getByText("SF Tracked")).toBeInTheDocument();
      // Rival App appears in multiple groups (tracked for 2 apps)
      expect(screen.getAllByText("Rival App").length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText("SF Competitor")).toBeInTheDocument();
    });
  });

  it("shows competitor count per app group", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Rival App")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /By App/i }));

    await waitFor(() => {
      const countBadges = screen.getAllByText("(1 competitor)");
      expect(countBadges.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows empty message in By App view when no competitors", async () => {
    setupFetchMocks({ items: [] });
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("No competitors tracked.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /By App/i }));

    await waitFor(() => {
      expect(screen.getByText("No competitors tracked.")).toBeInTheDocument();
    });
  });

  it("switches from By App back to List view", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Rival App")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /By App/i }));
    await waitFor(() => {
      expect(screen.getByText("My App")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /List/i }));
    await waitFor(() => {
      expect(screen.getByText("Platform")).toBeInTheDocument();
    });
  });

  it("persists By App view mode in localStorage", async () => {
    setupFetchMocks();
    render(<CrossPlatformCompetitorsPage />);
    await waitFor(() => {
      expect(screen.getByText("Rival App")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /By App/i }));

    expect(localStorage.getItem("competitors-view-mode")).toBe("by-app");
  });
});

// --- groupCompetitorsByApp unit tests ---

describe("groupCompetitorsByApp", () => {
  const makeComp = (id: number, name: string, apps: { id: number; name: string; slug: string; platform: string }[]): any => ({
    id,
    platform: apps[0]?.platform ?? "shopify",
    slug: name.toLowerCase().replace(/\s/g, "-"),
    name,
    iconUrl: null,
    averageRating: null,
    ratingCount: null,
    pricingHint: null,
    trackedForCount: apps.length,
    trackedForApps: apps.map((a) => ({ ...a, iconUrl: null })),
    activeInstalls: null,
  });

  it("groups competitors by their tracked apps", () => {
    const items = [
      makeComp(1, "Comp A", [{ id: 10, name: "App X", slug: "app-x", platform: "shopify" }]),
      makeComp(2, "Comp B", [{ id: 10, name: "App X", slug: "app-x", platform: "shopify" }]),
      makeComp(3, "Comp C", [{ id: 20, name: "App Y", slug: "app-y", platform: "salesforce" }]),
    ];

    const groups = groupCompetitorsByApp(items);
    expect(groups).toHaveLength(2);

    const appX = groups.find((g) => g.appName === "App X");
    expect(appX).toBeDefined();
    expect(appX!.items).toHaveLength(2);

    const appY = groups.find((g) => g.appName === "App Y");
    expect(appY).toBeDefined();
    expect(appY!.items).toHaveLength(1);
  });

  it("duplicates competitors tracked for multiple apps", () => {
    const items = [
      makeComp(1, "Shared Comp", [
        { id: 10, name: "App X", slug: "app-x", platform: "shopify" },
        { id: 20, name: "App Y", slug: "app-y", platform: "salesforce" },
      ]),
    ];

    const groups = groupCompetitorsByApp(items);
    expect(groups).toHaveLength(2);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[1].items).toHaveLength(1);
    // Same competitor appears in both groups
    expect(groups[0].items[0].id).toBe(1);
    expect(groups[1].items[0].id).toBe(1);
  });

  it("puts competitors without trackedForApps in 'Other' group", () => {
    const items = [
      makeComp(1, "Orphan Comp", []),
    ];
    // Override trackedForApps to empty
    items[0].trackedForApps = [];

    const groups = groupCompetitorsByApp(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].appName).toBe("Other");
    expect(groups[0].items).toHaveLength(1);
  });

  it("sorts groups alphabetically by app name", () => {
    const items = [
      makeComp(1, "Comp A", [{ id: 20, name: "Zeta App", slug: "zeta", platform: "shopify" }]),
      makeComp(2, "Comp B", [{ id: 10, name: "Alpha App", slug: "alpha", platform: "shopify" }]),
    ];

    const groups = groupCompetitorsByApp(items);
    expect(groups[0].appName).toBe("Alpha App");
    expect(groups[1].appName).toBe("Zeta App");
  });

  it("returns empty array for empty input", () => {
    expect(groupCompetitorsByApp([])).toEqual([]);
  });
});
