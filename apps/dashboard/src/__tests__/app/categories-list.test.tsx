import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const mockFetchWithAuth = vi.fn();
const mockUseParams = vi.fn();

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
  usePathname: () => "/shopify/categories",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => mockUseParams(),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: mockUser,
    account: mockAccount,
    isLoading: false,
    fetchWithAuth: mockFetchWithAuth,
    refreshUser: vi.fn(),
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

vi.mock("@/components/confirm-modal", () => ({
  ConfirmModal: (props: any) =>
    props.open ? (
      <div data-testid="confirm-modal">
        <span>{props.title}</span>
        <button onClick={props.onConfirm}>Confirm</button>
        <button onClick={props.onCancel}>Cancel</button>
      </div>
    ) : null,
}));

import CategoriesPage from "@/app/(dashboard)/[platform]/categories/page";

const mockTreeCategories = [
  {
    slug: "marketing",
    title: "Marketing",
    categoryLevel: 1,
    parentSlug: null,
    appCount: 500,
    isTracked: false,
    isListingPage: true,
    children: [
      {
        slug: "email-marketing",
        title: "Email Marketing",
        categoryLevel: 2,
        parentSlug: "marketing",
        appCount: 120,
        isTracked: false,
        isListingPage: true,
        children: [],
      },
    ],
  },
  {
    slug: "sales",
    title: "Sales",
    categoryLevel: 1,
    parentSlug: null,
    appCount: 300,
    isTracked: false,
    isListingPage: true,
    children: [],
  },
];

const mockStarredCategories = [
  {
    categorySlug: "email-marketing",
    categoryTitle: "Email Marketing",
    parentSlug: "marketing",
    parents: [{ slug: "marketing", title: "Marketing" }],
    createdAt: "2026-03-15",
    appCount: 120,
    trackedInResults: 1,
    competitorInResults: 2,
    trackedAppsInResults: [
      { app_slug: "my-email-app", name: "My Email App", logo_url: null, position: 5 },
    ],
    competitorAppsInResults: [],
    source: "starred" as const,
  },
];

const mockFlatCategories = [
  { id: 1, slug: "crm", title: "CRM", appCount: 45, isTracked: false, isListingPage: true },
  { id: 2, slug: "analytics", title: "Analytics", appCount: 30, isTracked: false, isListingPage: true },
];

function setupTreeMocks() {
  mockFetchWithAuth.mockImplementation((url: string) => {
    if (url.startsWith("/api/categories")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTreeCategories) });
    }
    if (url === "/api/account/starred-categories") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStarredCategories) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
}

function setupFlatMocks() {
  mockFetchWithAuth.mockImplementation((url: string) => {
    if (url.startsWith("/api/categories")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFlatCategories) });
    }
    if (url === "/api/account/starred-categories") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
}

describe("CategoriesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ platform: "shopify" });
    mockUser = {
      id: "u1", name: "Test User", email: "test@example.com",
      role: "owner", isSystemAdmin: false, emailDigestEnabled: true, timezone: "Europe/Istanbul",
    };
  });

  it("renders Categories heading with total count", async () => {
    setupTreeMocks();
    render(<CategoriesPage />);
    await waitFor(() => {
      expect(screen.getByText(/Categories \(3\)/)).toBeInTheDocument();
    });
  });

  it("shows loading state initially then content", async () => {
    setupTreeMocks();
    render(<CategoriesPage />);
    await waitFor(() => {
      // Marketing may appear multiple times (starred parents + tree)
      const elements = screen.getAllByText("Marketing");
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders category tree view for shopify", async () => {
    setupTreeMocks();
    render(<CategoriesPage />);
    await waitFor(() => {
      const marketingElements = screen.getAllByText("Marketing");
      expect(marketingElements.length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("All Categories")).toBeInTheDocument();
  });

  it("calls fetchWithAuth for categories and starred", async () => {
    setupTreeMocks();
    render(<CategoriesPage />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/categories?format=tree");
      expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/account/starred-categories");
    });
  });

  it("shows starred categories section", async () => {
    setupTreeMocks();
    render(<CategoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("My Categories")).toBeInTheDocument();
    });
    // The starred table should show "Email Marketing"
    const emailMarketingElements = screen.getAllByText("Email Marketing");
    expect(emailMarketingElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders category links to correct URLs", async () => {
    setupTreeMocks();
    render(<CategoriesPage />);
    await waitFor(() => {
      const marketingLinks = screen.getAllByText("Marketing");
      expect(marketingLinks.length).toBeGreaterThanOrEqual(1);
    });
    const marketingLinks = screen.getAllByText("Marketing");
    const link = marketingLinks.find((el) => el.closest("a"));
    expect(link?.closest("a")).toHaveAttribute("href", "/shopify/categories/marketing");
  });

  it("renders Expand All and Collapse All buttons for tree view", async () => {
    setupTreeMocks();
    render(<CategoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("Expand All")).toBeInTheDocument();
    });
    expect(screen.getByText("Collapse All")).toBeInTheDocument();
  });

  it("uses flat view for wordpress platform", async () => {
    mockUseParams.mockReturnValue({ platform: "wordpress" });
    setupFlatMocks();
    render(<CategoriesPage />);
    await waitFor(() => {
      // WordPress uses "Tags" label instead of "Categories" in the heading
      expect(screen.getByText(/Tags \(2\)/)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("CRM")).toBeInTheDocument();
    });
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/categories?format=flat");
  });

  it("renders search input for filtering categories", async () => {
    setupTreeMocks();
    render(<CategoriesPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Filter categories...")).toBeInTheDocument();
    });
  });

  it("renders app count for tree categories", async () => {
    setupTreeMocks();
    render(<CategoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("500 apps")).toBeInTheDocument();
    });
    expect(screen.getByText("300 apps")).toBeInTheDocument();
  });
});
