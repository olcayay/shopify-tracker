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
  usePathname: () => "/developers",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock auth context
const mockFetchWithAuth = vi.fn();
const mockUseAuth = vi.fn().mockReturnValue({
  ...mockAuthContext,
  fetchWithAuth: mockFetchWithAuth,
});

vi.mock("@/lib/auth-context", () => ({
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

vi.mock("@/contexts/feature-flags-context", () => ({
  useFeatureFlag: () => true,
  useFeatureFlags: () => ({ enabledFeatures: [], hasFeature: () => true }),
}));

vi.mock("@/hooks/use-platform-access", () => ({
  usePlatformAccess: () => ({
    accessiblePlatforms: [],
    hasPlatformAccess: () => true,
  }),
}));

// Mock components
vi.mock("@/components/skeletons", () => ({
  TableSkeleton: ({ rows, cols }: any) => (
    <div data-testid="table-skeleton">
      Loading {rows}x{cols}
    </div>
  ),
}));

vi.mock("@/lib/platform-display", () => ({
  getPlatformLabel: (p: string) => p.charAt(0).toUpperCase() + p.slice(1),
  getPlatformColor: () => "#000",
  PLATFORM_DISPLAY: {
    shopify: { label: "Shopify", color: "#95BF47" },
    salesforce: { label: "Salesforce", color: "#00A1E0" },
  },
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

import DevelopersPage from "@/app/(dashboard)/developers/page";

function makeJsonResponse(data: any) {
  return { ok: true, json: () => Promise.resolve(data) };
}

const mockDevelopersResponse = {
  developers: [
    {
      id: 1,
      slug: "acme-inc",
      name: "Acme Inc",
      website: "https://acme.com",
      platformCount: 2,
      linkCount: 3,
      appCount: 3,
      platforms: ["shopify", "salesforce"],
      topApps: [
        { iconUrl: "https://example.com/icon1.png", name: "App One", slug: "app-one", platform: "shopify" },
        { iconUrl: "https://example.com/icon2.png", name: "App Two", slug: "app-two", platform: "salesforce" },
      ],
      isStarred: true,
    },
    {
      id: 2,
      slug: "widget-co",
      name: "Widget Co",
      website: null,
      platformCount: 1,
      linkCount: 1,
      appCount: 1,
      platforms: ["shopify"],
      topApps: [],
      isStarred: false,
    },
  ],
  pagination: { page: 1, limit: 25, total: 2, totalPages: 1 },
};

function setupFetchMocks(
  overrides: { developers?: any[]; pagination?: any } = {}
) {
  const response = {
    developers: overrides.developers ?? mockDevelopersResponse.developers,
    pagination: overrides.pagination ?? mockDevelopersResponse.pagination,
  };
  mockFetchWithAuth.mockImplementation((url: string) => {
    if (url.includes("/api/developers/tracked")) {
      return Promise.resolve(makeJsonResponse({ developers: [] }));
    }
    if (url.includes("/api/developers/competitors")) {
      return Promise.resolve(makeJsonResponse({ developers: [] }));
    }
    if (url.includes("/api/developers")) {
      return Promise.resolve(makeJsonResponse(response));
    }
    return Promise.resolve(makeJsonResponse(null));
  });
}

describe("DevelopersPage (cross-platform)", () => {
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
    render(<DevelopersPage />);
    expect(screen.getByText("Developers")).toBeInTheDocument();
    expect(
      screen.getByText("Browse all developers across platforms")
    ).toBeInTheDocument();
  });

  it("shows loading skeleton initially", () => {
    mockFetchWithAuth.mockImplementation(() => new Promise(() => {}));
    render(<DevelopersPage />);
    // PLA-1101: My/Competitor top sections now render their own table-skeleton
    // placeholders too while loading, so >=1 skeleton is expected.
    expect(screen.getAllByTestId("table-skeleton").length).toBeGreaterThanOrEqual(1);
  });

  it("calls fetchWithAuth for developers endpoint", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("/api/developers")
      );
    });
  });

  it("renders developer names in the table after loading", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
      expect(screen.getByText("Widget Co")).toBeInTheDocument();
    });
  });

  it("renders platform badges for each developer", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    // Acme Inc has shopify and salesforce
    expect(
      screen.getAllByTestId("platform-badge-shopify").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByTestId("platform-badge-salesforce")
    ).toBeInTheDocument();
  });

  it("renders platform count for each developer", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    // Platform count "2" for Acme, "1" for Widget Co — PLA-1100 added an
    // App Count column that can duplicate these numbers, so assert presence
    // via getAllByText rather than getByText.
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);
  });

  it("renders search input", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    expect(
      screen.getByPlaceholderText("Search developers...")
    ).toBeInTheDocument();
  });

  it("renders sort buttons in table headers", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /^Developer$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Platform Count/i })
    ).toBeInTheDocument();
  });

  it("shows empty message when no developers found", async () => {
    setupFetchMocks({ developers: [] });
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("No developers found.")).toBeInTheDocument();
    });
  });

  it("does not show pagination when only 1 page", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
  });

  it("shows pagination when multiple pages", async () => {
    setupFetchMocks({
      pagination: { page: 1, limit: 25, total: 100, totalPages: 4 },
    });
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(
        screen.getByText("Page 1 of 4 (100 developers)")
      ).toBeInTheDocument();
    });
  });

  it("renders developer name as link to developer detail page", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    const link = screen.getByText("Acme Inc").closest("a");
    expect(link).toHaveAttribute("href", "/developers/acme-inc");
  });

  it("renders table column headers", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    expect(screen.getByText("Platforms")).toBeInTheDocument();
  });

  it("search form submits and resets page", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search developers...");
    fireEvent.change(searchInput, { target: { value: "acme" } });
    const searchButton = screen.getByRole("button", { name: /Search/i });
    const callCountBefore = mockFetchWithAuth.mock.calls.length;
    fireEvent.click(searchButton);
    await waitFor(() => {
      expect(mockFetchWithAuth.mock.calls.length).toBeGreaterThan(
        callCountBefore
      );
    });
  });

  it("clicking sort button triggers data reload", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    const callCountBefore = mockFetchWithAuth.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /^Developer$/i }));
    await waitFor(() => {
      expect(mockFetchWithAuth.mock.calls.length).toBeGreaterThan(
        callCountBefore
      );
    });
  });

  it("renders clickable app icons with tooltips for developers with apps", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    // Acme Inc has 2 top apps with icons
    const icons = document.querySelectorAll("img[src*='example.com']");
    expect(icons.length).toBe(2);
    expect(icons[0]).toHaveAttribute("src", "https://example.com/icon1.png");
    // Icons should be wrapped in links to app pages
    const appLink = icons[0].closest("a");
    expect(appLink).toHaveAttribute("href", "/shopify/apps/app-one");
  });

  it("does not render icon stack for developers with no icons", async () => {
    setupFetchMocks({
      developers: [
        {
          id: 2,
          slug: "widget-co",
          name: "Widget Co",
          website: null,
          platformCount: 1,
          linkCount: 1,
          appCount: 1,
          platforms: ["shopify"],
          topApps: [],
          isStarred: false,
        },
      ],
    });
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Widget Co")).toBeInTheDocument();
    });
    expect(document.querySelectorAll("img[src*='example.com']")).toHaveLength(0);
  });

  it("shows +N badge when developer has more than 10 app icons", async () => {
    setupFetchMocks({
      developers: [
        {
          id: 3,
          slug: "mega-dev",
          name: "Mega Dev",
          website: null,
          platformCount: 3,
          linkCount: 5,
          appCount: 14,
          platforms: ["shopify", "salesforce", "wix"],
          isStarred: false,
          topApps: [
            { iconUrl: "https://example.com/a.png", name: "App A", slug: "app-a", platform: "shopify" },
            { iconUrl: "https://example.com/b.png", name: "App B", slug: "app-b", platform: "shopify" },
            { iconUrl: "https://example.com/c.png", name: "App C", slug: "app-c", platform: "salesforce" },
            { iconUrl: "https://example.com/d.png", name: "App D", slug: "app-d", platform: "wix" },
            { iconUrl: "https://example.com/e.png", name: "App E", slug: "app-e", platform: "shopify" },
            { iconUrl: "https://example.com/f.png", name: "App F", slug: "app-f", platform: "shopify" },
            { iconUrl: "https://example.com/g.png", name: "App G", slug: "app-g", platform: "salesforce" },
            { iconUrl: "https://example.com/h.png", name: "App H", slug: "app-h", platform: "wix" },
            { iconUrl: "https://example.com/i.png", name: "App I", slug: "app-i", platform: "shopify" },
            { iconUrl: "https://example.com/j.png", name: "App J", slug: "app-j", platform: "wix" },
            { iconUrl: "https://example.com/k.png", name: "App K", slug: "app-k", platform: "salesforce" },
          ],
        },
      ],
    });
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Mega Dev")).toBeInTheDocument();
    });
    // 10 icons rendered + "+4" badge (14 total - 10 shown = 4 remaining)
    expect(document.querySelectorAll("img[src*='example.com']")).toHaveLength(10);
    expect(screen.getByText("+4")).toBeInTheDocument();
  });

  it("renders bookmark buttons for each developer", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    const bookmarkButtons = screen.getAllByLabelText(/bookmark developer|remove bookmark/i);
    expect(bookmarkButtons.length).toBe(2);
  });

  it("shows filled bookmark for starred developers", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    // Acme Inc is starred — its bookmark button should have the remove label
    expect(screen.getByLabelText("Remove bookmark")).toBeInTheDocument();
    // Widget Co is not starred — its bookmark button should have the bookmark label
    expect(screen.getByLabelText("Bookmark developer")).toBeInTheDocument();
  });

  it("toggles bookmark on click with optimistic update", async () => {
    mockFetchWithAuth.mockImplementation((url: string, opts?: any) => {
      if (url.includes("/api/developers/tracked")) {
        return Promise.resolve(makeJsonResponse({ developers: [] }));
      }
      if (url.includes("/api/developers/competitors")) {
        return Promise.resolve(makeJsonResponse({ developers: [] }));
      }
      if (url.includes("/api/developers")) {
        return Promise.resolve(makeJsonResponse(mockDevelopersResponse));
      }
      // Star/unstar endpoint
      if (url.includes("/api/account/starred-developers/")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ message: "ok" }) });
      }
      return Promise.resolve(makeJsonResponse(null));
    });
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    // Click the bookmark button for Widget Co (not starred)
    const bookmarkButton = screen.getByLabelText("Bookmark developer");
    fireEvent.click(bookmarkButton);
    // After click, should now show two "Remove bookmark" labels
    await waitFor(() => {
      expect(screen.getAllByLabelText("Remove bookmark").length).toBe(2);
    });
  });

  it("renders view mode toggle buttons", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    expect(screen.getByTitle("Flat list")).toBeInTheDocument();
    expect(screen.getByTitle("Group by platform")).toBeInTheDocument();
  });

  it("switches to grouped view and shows platform groups", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    // Switch to grouped view
    fireEvent.click(screen.getByTitle("Group by platform"));
    await waitFor(() => {
      // Platform group headers should appear (Acme has shopify+salesforce, Widget has shopify)
      expect(screen.getByTestId("platform-group-shopify")).toBeInTheDocument();
      expect(screen.getByTestId("platform-group-salesforce")).toBeInTheDocument();
    });
  });

  it("collapses and expands platform groups", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle("Group by platform"));
    await waitFor(() => {
      expect(screen.getByTestId("platform-group-shopify")).toBeInTheDocument();
    });
    // Acme Inc appears in both Shopify and Salesforce groups
    expect(screen.getAllByText("Acme Inc").length).toBe(2);
    // Click on Shopify platform group header to collapse
    fireEvent.click(screen.getByTestId("platform-group-shopify"));
    // After collapse, Acme only appears in Salesforce group
    await waitFor(() => {
      expect(screen.getAllByText("Acme Inc").length).toBe(1);
    });
    // Re-expand Shopify
    fireEvent.click(screen.getByTestId("platform-group-shopify"));
    await waitFor(() => {
      expect(screen.getAllByText("Acme Inc").length).toBe(2);
    });
  });

  it("re-sorts list after starring a developer (starred moves to top)", async () => {
    // Set up with unstarred developer first, starred second
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/api/developers/tracked")) {
        return Promise.resolve(makeJsonResponse({ developers: [] }));
      }
      if (url.includes("/api/developers/competitors")) {
        return Promise.resolve(makeJsonResponse({ developers: [] }));
      }
      if (url.includes("/api/developers")) {
        return Promise.resolve(
          makeJsonResponse({
            developers: [
              {
                id: 10,
                slug: "beta-dev",
                name: "Beta Dev",
                website: null,
                platformCount: 1,
                linkCount: 1,
                platforms: ["shopify"],
                topApps: [],
                appCount: 0,
                isStarred: false,
              },
              {
                id: 11,
                slug: "alpha-dev",
                name: "Alpha Dev",
                website: null,
                platformCount: 1,
                linkCount: 2,
                platforms: ["shopify"],
                topApps: [],
                appCount: 0,
                isStarred: true,
              },
            ],
            pagination: { page: 1, limit: 25, total: 2, totalPages: 1 },
          })
        );
      }
      if (url.includes("/api/account/starred-developers/")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ message: "ok" }) });
      }
      return Promise.resolve(makeJsonResponse(null));
    });
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Beta Dev")).toBeInTheDocument();
    });
    // Check initial order: rows in DOM. Alpha (starred) should be first due to API sort.
    // But our test data has Beta first, Alpha second (as API returned).
    // After starring Beta, it should move to top (both starred now, sorted by name).
    const rows = screen.getAllByRole("row");
    // Find the bookmark button for Beta Dev (the unstarred one)
    const bookmarkBtn = screen.getByLabelText("Bookmark developer");
    fireEvent.click(bookmarkBtn);
    // After optimistic update, both are starred, sorted alphabetically: Alpha, Beta
    await waitFor(() => {
      const links = screen.getAllByRole("link").filter((l) => l.textContent === "Alpha Dev" || l.textContent === "Beta Dev");
      expect(links[0].textContent).toBe("Alpha Dev");
      expect(links[1].textContent).toBe("Beta Dev");
    });
  });

  it("shows My Developers section when tracked developers exist", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/api/developers/tracked")) {
        return Promise.resolve(
          makeJsonResponse({
            developers: [
              {
                id: 100,
                slug: "tracked-dev",
                name: "Tracked Dev Co",
                platformCount: 1,
                platforms: ["shopify"],
                isStarred: false,
                trackedApps: [
                  { slug: "my-app", name: "My App", platform: "shopify", iconUrl: "https://example.com/tracked.png" },
                ],
              },
            ],
          })
        );
      }
      if (url.includes("/api/developers/competitors")) {
        return Promise.resolve(makeJsonResponse({ developers: [] }));
      }
      if (url.includes("/api/developers")) {
        return Promise.resolve(makeJsonResponse(mockDevelopersResponse));
      }
      return Promise.resolve(makeJsonResponse(null));
    });
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("My Developers")).toBeInTheDocument();
      expect(screen.getByText("Tracked Dev Co")).toBeInTheDocument();
      expect(screen.getByText("My App")).toBeInTheDocument();
    });
  });

  it("shows empty state for My Developers when no tracked developers", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    // My Developers section is shown with empty state
    expect(screen.getByText("My Developers")).toBeInTheDocument();
    expect(screen.getByText("No tracked app developers yet")).toBeInTheDocument();
  });

  it("pagination buttons are disabled when on first page", async () => {
    setupFetchMocks({
      pagination: { page: 1, limit: 25, total: 50, totalPages: 2 },
    });
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2 (50 developers)")).toBeInTheDocument();
    });
    // Find the previous/next buttons - they contain ChevronLeft/ChevronRight icons
    const navButtons = screen
      .getByText("Page 1 of 2 (50 developers)")
      .closest("div")!
      .parentElement!.querySelectorAll("button");
    // The "previous" button (first) should be disabled on page 1
    const prevButton = navButtons[navButtons.length - 2];
    const nextButton = navButtons[navButtons.length - 1];
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });
});
