import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useParams } from "next/navigation";

const mockFetchWithAuth = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useParams: vi.fn(() => ({ platform: "shopify", id: "project-1" })),
    useRouter: () => ({
      push: mockPush,
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn(),
    }),
  };
});

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      name: "Test User",
      email: "test@example.com",
      role: "owner",
      isSystemAdmin: false,
    },
    account: {
      id: "acc-1",
      name: "Test Account",
    },
    isLoading: false,
    fetchWithAuth: mockFetchWithAuth,
  }),
}));

// Mock components that have complex dependencies
vi.mock("@/components/confirm-modal", () => ({
  ConfirmModal: ({
    open,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div data-testid="confirm-modal">
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

vi.mock("@/components/live-search-trigger", () => ({
  LiveSearchTrigger: ({ keyword }: { keyword: string }) => (
    <span data-testid="live-search">{keyword}</span>
  ),
}));

vi.mock("@/lib/platform-urls", () => ({
  buildExternalAppUrl: (platform: string, slug: string) =>
    `https://example.com/${platform}/${slug}`,
  buildExternalSearchUrl: (platform: string, query: string) =>
    `https://example.com/search?q=${query}`,
  getPlatformName: (platform: string) =>
    platform.charAt(0).toUpperCase() + platform.slice(1),
  formatCategoryTitle: (_platform: string, _slug: string, title: string) =>
    title,
}));

vi.mock("@appranks/shared", () => ({
  PLATFORMS: {
    shopify: { baseUrl: "https://apps.shopify.com", name: "Shopify" },
  },
  isPlatformId: (id: string) => id === "shopify",
}));

import ResearchProjectPage from "@/app/(dashboard)/[platform]/research/[id]/page";

const fullProjectData = {
  project: {
    id: "project-1",
    name: "Test Research Project",
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-15T00:00:00Z",
  },
  keywords: [
    {
      id: 1,
      keyword: "pos system",
      slug: "pos-system",
      totalResults: 150,
      scrapedAt: "2026-03-10T00:00:00Z",
    },
    {
      id: 2,
      keyword: "inventory",
      slug: "inventory",
      totalResults: 200,
      scrapedAt: "2026-03-10T00:00:00Z",
    },
    {
      id: 3,
      keyword: "shipping",
      slug: "shipping",
      totalResults: 120,
      scrapedAt: "2026-03-10T00:00:00Z",
    },
  ],
  competitors: [
    {
      slug: "comp-a",
      name: "Competitor A",
      iconUrl: null,
      averageRating: 4.5,
      ratingCount: 100,
      pricingHint: "free",
      minPaidPrice: 9.99,
      powerScore: 75,
      categories: [],
      features: ["Feature 1"],
      categoryRankings: [],
      launchedAt: null,
      featuredSections: 2,
      reverseSimilarCount: 5,
    },
    {
      slug: "comp-b",
      name: "Competitor B",
      iconUrl: null,
      averageRating: 3.8,
      ratingCount: 50,
      pricingHint: "paid",
      minPaidPrice: 19.99,
      powerScore: 60,
      categories: [],
      features: ["Feature 2"],
      categoryRankings: [],
      launchedAt: null,
      featuredSections: 1,
      reverseSimilarCount: 3,
    },
  ],
  keywordRankings: {
    "pos-system": { "comp-a": 3, "comp-b": 7 },
    inventory: { "comp-a": 5 },
  },
  competitorSuggestions: [
    {
      slug: "suggested-app",
      name: "Suggested App",
      iconUrl: null,
      averageRating: 4.0,
      ratingCount: 30,
      matchedKeywords: ["pos system"],
      matchedCount: 1,
      avgPosition: 5,
    },
  ],
  keywordSuggestions: [
    {
      keyword: "checkout",
      slug: "checkout",
      competitorCount: 2,
      bestPosition: 3,
      source: "ranking" as const,
    },
  ],
  wordAnalysis: [
    {
      word: "inventory",
      totalScore: 15,
      appCount: 3,
      sources: { title: 5, description: 10 },
    },
  ],
  categories: [
    {
      slug: "store-management",
      title: "Store Management",
      competitorCount: 2,
      total: 50,
      competitors: [
        { slug: "comp-a", position: 3 },
        { slug: "comp-b", position: 10 },
      ],
    },
  ],
  featureCoverage: [
    {
      feature: "inventory-tracking",
      title: "Inventory Tracking",
      count: 2,
      total: 2,
      competitors: ["comp-a", "comp-b"],
      isGap: false,
    },
    {
      feature: "analytics",
      title: "Analytics",
      count: 1,
      total: 2,
      competitors: ["comp-a"],
      isGap: true,
    },
  ],
  opportunities: [
    {
      keyword: "pos system",
      slug: "pos-system",
      opportunityScore: 75,
      room: 80,
      demand: 70,
      competitorCount: 2,
      totalResults: 150,
    },
  ],
  virtualApps: [
    {
      id: "va-1",
      researchProjectId: "project-1",
      name: "My Virtual App",
      icon: "rocket",
      color: "#3B82F6",
      iconUrl: null,
      appCardSubtitle: "A virtual app",
      appIntroduction: "Introduction text",
      appDetails: "Details text",
      seoTitle: "SEO Title",
      seoMetaDescription: "SEO description",
      features: ["Feature X"],
      integrations: ["Integration Y"],
      languages: [],
      categories: [],
      pricingPlans: [],
      createdAt: "2026-03-01T00:00:00Z",
      updatedAt: "2026-03-15T00:00:00Z",
    },
  ],
};

describe("ResearchProjectPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useParams).mockReturnValue({
      platform: "shopify",
      id: "project-1",
    });
  });

  it("shows loading skeleton initially", () => {
    mockFetchWithAuth.mockReturnValue(new Promise(() => {}));
    const { container } = render(<ResearchProjectPage />);
    // Skeleton component renders divs with specific classes
    expect(container.querySelector(".space-y-6")).toBeInTheDocument();
  });

  it("renders project name after loading", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fullProjectData),
    });
    render(<ResearchProjectPage />);
    await waitFor(() => {
      expect(
        screen.getByText("Test Research Project")
      ).toBeInTheDocument();
    });
  });

  it("calls fetchWithAuth with correct project ID", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fullProjectData),
    });
    render(<ResearchProjectPage />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/api/research-projects/project-1/data"
      );
    });
  });

  it("shows error message when project not found", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      status: 404,
    });
    render(<ResearchProjectPage />);
    await waitFor(() => {
      expect(screen.getByText("Project not found")).toBeInTheDocument();
    });
  });

  it("shows Back to Projects button on error", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      status: 404,
    });
    render(<ResearchProjectPage />);
    await waitFor(() => {
      expect(screen.getByText("Back to Projects")).toBeInTheDocument();
    });
  });

  it("renders keyword count button", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fullProjectData),
    });
    render(<ResearchProjectPage />);
    await waitFor(() => {
      expect(screen.getByText("3 Keywords")).toBeInTheDocument();
    });
  });

  it("renders competitor count button", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fullProjectData),
    });
    render(<ResearchProjectPage />);
    await waitFor(() => {
      expect(screen.getByText("2 Competitors")).toBeInTheDocument();
    });
  });

  it("renders Compare button when competitors exist", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fullProjectData),
    });
    render(<ResearchProjectPage />);
    await waitFor(() => {
      expect(screen.getByText("Compare")).toBeInTheDocument();
    });
  });

  it("renders Virtual Apps section", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fullProjectData),
    });
    render(<ResearchProjectPage />);
    await waitFor(() => {
      // "Virtual Apps" appears in both summary card and section title
      const elements = screen.getAllByText("Virtual Apps");
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders virtual app names", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fullProjectData),
    });
    render(<ResearchProjectPage />);
    await waitFor(() => {
      // Virtual app name appears in both summary cards and virtual apps section
      const elements = screen.getAllByText("My Virtual App");
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders competitor names in competitor table", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fullProjectData),
    });
    render(<ResearchProjectPage />);
    await waitFor(() => {
      // Competitor names may appear in multiple places (table + summary)
      const compA = screen.getAllByText("Competitor A");
      expect(compA.length).toBeGreaterThanOrEqual(1);
      const compB = screen.getAllByText("Competitor B");
      expect(compB.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders section titles for rich data sections", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fullProjectData),
    });
    render(<ResearchProjectPage />);
    await waitFor(() => {
      expect(screen.getByText("Your Competitors")).toBeInTheDocument();
    });
  });

  it("renders Keyword Opportunities section", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fullProjectData),
    });
    render(<ResearchProjectPage />);
    await waitFor(() => {
      expect(
        screen.getByText("Keyword Opportunities")
      ).toBeInTheDocument();
    });
  });
});
