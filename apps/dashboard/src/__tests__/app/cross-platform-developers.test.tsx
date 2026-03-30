import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { mockAuthContext } from "../test-utils";

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
      platforms: ["shopify", "salesforce"],
      topAppIcons: ["https://example.com/icon1.png", "https://example.com/icon2.png", "https://example.com/icon3.png"],
      isStarred: true,
    },
    {
      id: 2,
      slug: "widget-co",
      name: "Widget Co",
      website: null,
      platformCount: 1,
      linkCount: 1,
      platforms: ["shopify"],
      topAppIcons: [],
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
    expect(screen.getByTestId("table-skeleton")).toBeInTheDocument();
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
    // Platform count column
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
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

  it("renders app icon stack for developers with icons", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    // Acme Inc has 3 icons — img elements with alt=""
    const icons = document.querySelectorAll("img[src*='example.com']");
    expect(icons.length).toBe(3);
    expect(icons[0]).toHaveAttribute("src", "https://example.com/icon1.png");
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
          platforms: ["shopify"],
          topAppIcons: [],
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

  it("shows +N badge when developer has more than 4 icons", async () => {
    setupFetchMocks({
      developers: [
        {
          id: 3,
          slug: "mega-dev",
          name: "Mega Dev",
          website: null,
          platformCount: 3,
          linkCount: 5,
          platforms: ["shopify", "salesforce", "wix"],
          isStarred: false,
          topAppIcons: [
            "https://example.com/a.png",
            "https://example.com/b.png",
            "https://example.com/c.png",
            "https://example.com/d.png",
            "https://example.com/e.png",
          ],
        },
      ],
    });
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Mega Dev")).toBeInTheDocument();
    });
    // 4 icons rendered + "+1" badge
    expect(document.querySelectorAll("img[src*='example.com']")).toHaveLength(4);
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("renders star buttons for each developer", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    const starButtons = screen.getAllByLabelText(/star developer/i);
    expect(starButtons.length).toBe(2);
  });

  it("shows filled star for starred developers", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    // Acme Inc is starred — its star button should have the unstar label
    expect(screen.getByLabelText("Unstar developer")).toBeInTheDocument();
    // Widget Co is not starred — its star button should have the star label
    expect(screen.getByLabelText("Star developer")).toBeInTheDocument();
  });

  it("toggles star on click with optimistic update", async () => {
    mockFetchWithAuth.mockImplementation((url: string, opts?: any) => {
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
    // Click the star button for Widget Co (not starred)
    const starButton = screen.getByLabelText("Star developer");
    fireEvent.click(starButton);
    // After click, should now show two "Unstar developer" labels
    await waitFor(() => {
      expect(screen.getAllByLabelText("Unstar developer").length).toBe(2);
    });
  });

  it("renders view mode toggle buttons", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("List view")).toBeInTheDocument();
    expect(screen.getByLabelText("Grouped view")).toBeInTheDocument();
  });

  it("switches to grouped view and shows platform groups", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    // Switch to grouped view
    fireEvent.click(screen.getByLabelText("Grouped view"));
    await waitFor(() => {
      // Platform group headers should appear (Acme has shopify+salesforce, Widget has shopify)
      expect(screen.getByText("Shopify")).toBeInTheDocument();
      expect(screen.getByText("Salesforce")).toBeInTheDocument();
    });
  });

  it("collapses and expands platform groups", async () => {
    setupFetchMocks();
    render(<DevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Grouped view"));
    await waitFor(() => {
      expect(screen.getByText("Shopify")).toBeInTheDocument();
    });
    // Before collapse: tables should exist
    const groupsBefore = document.querySelectorAll("table");
    expect(groupsBefore.length).toBeGreaterThan(0);
    // Click on Shopify group header to collapse
    fireEvent.click(screen.getByText("Shopify").closest("button")!);
    // After collapse, Shopify group's table should be removed
    // Salesforce group table should still exist
    await waitFor(() => {
      // Check that a table still exists (Salesforce group)
      expect(document.querySelectorAll("table").length).toBe(1);
    });
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
