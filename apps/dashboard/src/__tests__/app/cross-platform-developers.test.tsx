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
    },
    {
      id: 2,
      slug: "widget-co",
      name: "Widget Co",
      website: null,
      platformCount: 1,
      linkCount: 1,
      platforms: ["shopify"],
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
      screen.getByRole("button", { name: /Developer/i })
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
    expect(link).toHaveAttribute("href", "/shopify/developers/acme-inc");
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
    fireEvent.click(screen.getByRole("button", { name: /Developer/i }));
    await waitFor(() => {
      expect(mockFetchWithAuth.mock.calls.length).toBeGreaterThan(
        callCountBefore
      );
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
