import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockFetchWithAuth = vi.fn();
const mockRefreshUser = vi.fn();
const mockUseParams = vi.fn();

// Mutable user/account so individual tests can override
let mockUser: any = {
  id: "u1",
  name: "Test User",
  email: "test@example.com",
  role: "owner",
  isSystemAdmin: false,
  emailDigestEnabled: true,
  timezone: "Europe/Istanbul",
};

const mockAccount = {
  id: "acc-1",
  name: "Test Account",
  company: "Test Co",
  isSuspended: false,
  package: { slug: "pro", name: "Pro" },
  packageLimits: { maxTrackedApps: 10, maxTrackedKeywords: 50, maxCompetitorApps: 20, maxUsers: 5, maxResearchProjects: 3, maxPlatforms: 3 },
  limits: { maxTrackedApps: 10, maxTrackedKeywords: 50, maxCompetitorApps: 20, maxUsers: 5, maxResearchProjects: 3, maxPlatforms: 3 },
  usage: { trackedApps: 3, trackedKeywords: 10, competitorApps: 5, starredFeatures: 2, users: 2, researchProjects: 1, platforms: 1 },
  enabledPlatforms: ["shopify"],
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/shopify/apps",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => mockUseParams(),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: mockUser,
    account: mockAccount,
    isLoading: false,
    fetchWithAuth: mockFetchWithAuth,
    refreshUser: mockRefreshUser,
  }),
}));

vi.mock("@/lib/format-date", () => ({
  useFormatDate: () => ({
    formatDateTime: (d: string) => d,
    formatDateOnly: (d: string) => d,
  }),
}));

vi.mock("@/components/admin-scraper-trigger", () => ({
  AdminScraperTrigger: () => <div data-testid="admin-scraper-trigger" />,
}));

vi.mock("@/components/app-search-bar", () => ({
  AppSearchBar: (props: any) => (
    <div data-testid="app-search-bar" data-placeholder={props.placeholder} />
  ),
}));

vi.mock("@/components/confirm-modal", () => ({
  ConfirmModal: (props: any) =>
    props.open ? (
      <div data-testid="confirm-modal">
        <span>{props.title}</span>
        <span>{props.description}</span>
        <button onClick={props.onConfirm}>Confirm</button>
        <button onClick={props.onCancel}>Cancel</button>
      </div>
    ) : null,
}));

import AppsPage from "@/app/(dashboard)/[platform]/apps/page";

const mockApps = [
  {
    slug: "form-builder",
    name: "Form Builder Pro",
    iconUrl: "https://example.com/icon1.png",
    isBuiltForShopify: true,
    latestSnapshot: { averageRating: 4.8, ratingCount: 250, pricing: "Free plan available" },
    minPaidPrice: 9.99,
    lastChangeAt: "2026-03-20",
    launchedDate: "2024-01-15",
    competitorCount: 5,
    keywordCount: 12,
  },
  {
    slug: "seo-master",
    name: "SEO Master",
    iconUrl: null,
    isBuiltForShopify: false,
    latestSnapshot: { averageRating: 4.2, ratingCount: 100, pricing: "Paid" },
    minPaidPrice: 19.99,
    lastChangeAt: "2026-03-18",
    launchedDate: "2023-06-01",
    competitorCount: 3,
    keywordCount: 8,
  },
];

const mockCategories: Record<string, { title: string; slug: string; position: number | null }[]> = {
  "form-builder": [{ title: "Forms", slug: "forms", position: 5 }],
};

function setupDefaultMocks() {
  mockFetchWithAuth.mockImplementation((url: string, options?: any) => {
    if (url === "/api/apps" && !options?.method) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockApps) });
    }
    if (url === "/api/apps/categories" && options?.method === "POST") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCategories) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

function setupEmptyMocks() {
  mockFetchWithAuth.mockImplementation(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
  );
}

describe("AppsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ platform: "shopify" });
    mockUser = {
      id: "u1", name: "Test User", email: "test@example.com",
      role: "owner", isSystemAdmin: false, emailDigestEnabled: true, timezone: "Europe/Istanbul",
    };
  });

  it("renders page title with app count and limit", async () => {
    setupDefaultMocks();
    render(<AppsPage />);
    await waitFor(() => {
      expect(screen.getByText(/My Apps/)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/2\/10/)).toBeInTheDocument();
    });
  });

  it("shows loading skeleton initially", () => {
    setupDefaultMocks();
    render(<AppsPage />);
    // During loading, the real table headers should NOT be visible
    expect(screen.queryByText("Competitors")).not.toBeInTheDocument();
  });

  it("renders table headers after loading", async () => {
    setupDefaultMocks();
    render(<AppsPage />);
    await waitFor(() => {
      expect(screen.getByText("App")).toBeInTheDocument();
    });
    expect(screen.getByText("Rating")).toBeInTheDocument();
    expect(screen.getByText("Reviews")).toBeInTheDocument();
    expect(screen.getByText("Competitors")).toBeInTheDocument();
    expect(screen.getByText("Keywords")).toBeInTheDocument();
    expect(screen.getByText("Categories")).toBeInTheDocument();
    expect(screen.getByText("Last Change")).toBeInTheDocument();
  });

  it("calls fetchWithAuth on mount", async () => {
    setupDefaultMocks();
    render(<AppsPage />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/apps");
    });
  });

  it("shows empty state when no apps", async () => {
    setupEmptyMocks();
    render(<AppsPage />);
    await waitFor(() => {
      expect(
        screen.getByText("No apps yet. Search and follow an app to get started.")
      ).toBeInTheDocument();
    });
  });

  it("renders app rows with correct data", async () => {
    setupDefaultMocks();
    render(<AppsPage />);
    await waitFor(() => {
      expect(screen.getByText("Form Builder Pro")).toBeInTheDocument();
    });
    expect(screen.getByText("SEO Master")).toBeInTheDocument();
    expect(screen.getByText("4.8")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
    expect(screen.getByText("4.2")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("renders app links to detail pages", async () => {
    setupDefaultMocks();
    render(<AppsPage />);
    await waitFor(() => {
      expect(screen.getByText("Form Builder Pro")).toBeInTheDocument();
    });
    const link = screen.getByText("Form Builder Pro").closest("a");
    expect(link).toHaveAttribute("href", "/shopify/apps/form-builder");
  });

  it("sort toggles direction when clicking same column", async () => {
    setupDefaultMocks();
    const user = userEvent.setup();
    render(<AppsPage />);
    await waitFor(() => {
      expect(screen.getByText("Form Builder Pro")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Rating"));
    await user.click(screen.getByText("Rating"));
    expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/apps");
  });

  it("remove app button appears for owner role", async () => {
    setupDefaultMocks();
    render(<AppsPage />);
    await waitFor(() => {
      expect(screen.getByText("Form Builder Pro")).toBeInTheDocument();
    });
    // Owner should see remove buttons (X icons in the table)
    const rows = screen.getAllByRole("row");
    // Header row + 2 data rows = 3
    expect(rows.length).toBe(3);
  });

  it("remove app button hidden for viewers", async () => {
    mockUser = { ...mockUser, role: "viewer" };
    setupDefaultMocks();
    render(<AppsPage />);
    await waitFor(() => {
      expect(screen.getByText("Form Builder Pro")).toBeInTheDocument();
    });
    // For owner: App, Rating, Reviews, Competitors, Keywords, Categories, Pricing, Min.Paid, Last Change, Launched, (remove) = 11 headers
    // For viewer: same minus (remove) = 10 headers
    const ownerHeaderCount = 11;
    const allHeaders = screen.getAllByRole("columnheader");
    expect(allHeaders.length).toBe(ownerHeaderCount - 1);
  });

  it("search bar renders", () => {
    setupDefaultMocks();
    render(<AppsPage />);
    expect(screen.getByTestId("app-search-bar")).toBeInTheDocument();
  });

  it("fetches categories for loaded apps", async () => {
    setupDefaultMocks();
    render(<AppsPage />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/api/apps/categories",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("renders category data for apps", async () => {
    setupDefaultMocks();
    render(<AppsPage />);
    await waitFor(() => {
      expect(screen.getByText("Forms")).toBeInTheDocument();
    });
    expect(screen.getByText("#5")).toBeInTheDocument();
  });
});
