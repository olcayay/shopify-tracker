import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockFetchWithAuth = vi.fn();
const mockRefreshUser = vi.fn();
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
  usePathname: () => "/shopify/keywords",
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

vi.mock("@/components/keyword-search-modal", () => ({
  KeywordSearchModal: () => <div data-testid="keyword-search-modal" />,
}));

vi.mock("@/components/live-search-trigger", () => ({
  LiveSearchTrigger: () => <div data-testid="live-search-trigger" />,
}));

vi.mock("@/components/keyword-tag-badge", () => ({
  KeywordTagBadge: ({ tag }: any) => <span data-testid="tag-badge">{tag.name}</span>,
}));

vi.mock("@/components/keyword-tag-manager", () => ({
  KeywordTagManager: () => <div data-testid="keyword-tag-manager" />,
}));

vi.mock("@/components/keyword-tag-filter", () => ({
  KeywordTagFilter: () => <div data-testid="keyword-tag-filter" />,
}));

vi.mock("@/components/keyword-word-group-filter", () => ({
  KeywordWordGroupFilter: () => <div data-testid="keyword-word-group-filter" />,
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

import KeywordsPage from "@/app/(dashboard)/[platform]/keywords/page";

const mockKeywords = [
  {
    id: 1,
    keyword: "form builder",
    slug: "form-builder",
    latestSnapshot: { totalResults: 1500, scrapedAt: "2026-03-20T10:00:00Z" },
    trackedInResults: 2,
    competitorInResults: 3,
    adApps: 1,
    tags: [],
    trackedForApps: ["form-builder"],
    trackedAppsInResults: [],
    competitorAppsInResults: [],
  },
  {
    id: 2,
    keyword: "contact form",
    slug: "contact-form",
    latestSnapshot: { totalResults: 800, scrapedAt: "2026-03-19T12:00:00Z" },
    trackedInResults: 1,
    competitorInResults: 0,
    adApps: 0,
    tags: [],
    trackedForApps: ["form-builder"],
    trackedAppsInResults: [],
    competitorAppsInResults: [],
  },
];

const mockApps = [{ appSlug: "form-builder", appName: "Form Builder Pro" }];

function setupDefaultMocks() {
  mockFetchWithAuth.mockImplementation((url: string) => {
    if (url === "/api/keywords") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockKeywords) });
    }
    if (url === "/api/account/tracked-apps") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockApps) });
    }
    if (url === "/api/account/keyword-tags") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

function setupEmptyMocks() {
  mockFetchWithAuth.mockImplementation(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
  );
}

describe("KeywordsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ platform: "shopify" });
    mockUser = {
      id: "u1", name: "Test User", email: "test@example.com",
      role: "owner", isSystemAdmin: false, emailDigestEnabled: true, timezone: "Europe/Istanbul",
    };
  });

  it("renders Tracked Keywords heading with count", async () => {
    setupDefaultMocks();
    render(<KeywordsPage />);
    await waitFor(() => {
      expect(screen.getByText(/Tracked Keywords/)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/2\/50/)).toBeInTheDocument();
    });
  });

  it("shows loading skeleton initially", () => {
    setupDefaultMocks();
    render(<KeywordsPage />);
    expect(screen.queryByText("Total Results")).not.toBeInTheDocument();
  });

  it("renders keyword table headers after loading", async () => {
    setupDefaultMocks();
    render(<KeywordsPage />);
    await waitFor(() => {
      expect(screen.getByText("Keyword")).toBeInTheDocument();
    });
    expect(screen.getByText("Total Results")).toBeInTheDocument();
    expect(screen.getByText("Tracked")).toBeInTheDocument();
    expect(screen.getByText("Competitor")).toBeInTheDocument();
    expect(screen.getByText("Ads")).toBeInTheDocument();
    expect(screen.getByText("Last Updated")).toBeInTheDocument();
  });

  it("calls fetchWithAuth on mount for keywords, apps, and tags", async () => {
    setupDefaultMocks();
    render(<KeywordsPage />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/keywords");
      expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/account/tracked-apps");
      expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/account/keyword-tags");
    });
  });

  it("shows empty state when no keywords", async () => {
    setupEmptyMocks();
    render(<KeywordsPage />);
    await waitFor(() => {
      expect(
        screen.getByText("No tracked keywords yet. Add keywords from your app detail pages.")
      ).toBeInTheDocument();
    });
  });

  it("renders keyword rows with data", async () => {
    setupDefaultMocks();
    render(<KeywordsPage />);
    await waitFor(() => {
      expect(screen.getByText("form builder")).toBeInTheDocument();
    });
    expect(screen.getByText("contact form")).toBeInTheDocument();
    // totalResults are displayed with toLocaleString()
    // Match both "1,500"/"1.500" (depends on locale) or raw number
    const totalResultCells = screen.getAllByRole("cell");
    const hasFormBuilderResults = totalResultCells.some(
      (cell) => cell.textContent === "1,500" || cell.textContent === "1.500"
    );
    expect(hasFormBuilderResults).toBe(true);
  });

  it("renders keyword links to detail pages", async () => {
    setupDefaultMocks();
    render(<KeywordsPage />);
    await waitFor(() => {
      expect(screen.getByText("form builder")).toBeInTheDocument();
    });
    const link = screen.getByText("form builder").closest("a");
    expect(link).toHaveAttribute("href", "/shopify/keywords/form-builder");
  });

  it("renders tracked and competitor badges", async () => {
    setupDefaultMocks();
    render(<KeywordsPage />);
    await waitFor(() => {
      expect(screen.getByText("form builder")).toBeInTheDocument();
    });
    // "form builder" has trackedInResults: 2 and competitorInResults: 3
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("remove button column present for owner role", async () => {
    setupDefaultMocks();
    render(<KeywordsPage />);
    await waitFor(() => {
      expect(screen.getByText("form builder")).toBeInTheDocument();
    });
    // Keyword, Total Results, Tracked, Competitor, Ads, Last Updated, (live search), (remove) = 8
    const allHeaders = screen.getAllByRole("columnheader");
    expect(allHeaders.length).toBe(8);
  });

  it("Ads column hidden for non-shopify platforms", async () => {
    mockUseParams.mockReturnValue({ platform: "salesforce" });
    setupDefaultMocks();
    render(<KeywordsPage />);
    await waitFor(() => {
      expect(screen.getByText("form builder")).toBeInTheDocument();
    });
    expect(screen.queryByText("Ads")).not.toBeInTheDocument();
  });

  it("sort toggles when clicking column header", async () => {
    setupDefaultMocks();
    const user = userEvent.setup();
    render(<KeywordsPage />);
    await waitFor(() => {
      expect(screen.getByText("form builder")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Total Results"));
    expect(screen.getByText("form builder")).toBeInTheDocument();
    expect(screen.getByText("contact form")).toBeInTheDocument();
  });
});
