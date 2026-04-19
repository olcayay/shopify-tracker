import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useParams } from "next/navigation";

vi.mock("next/navigation", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useParams: vi.fn(() => ({ platform: "shopify", slug: "test-app" })),
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn(),
    }),
    usePathname: () => "/shopify/apps/test-app/compare",
    useSearchParams: () => new URLSearchParams(),
  };
});

const mockFetchWithAuth = vi.fn();

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
      enabledPlatforms: ["shopify"],
    },
    isLoading: false,
    fetchWithAuth: mockFetchWithAuth,
  }),
}));

// Mock skeletons to keep tests simple
vi.mock("@/components/skeletons", () => ({
  CardSkeleton: ({ lines }: { lines?: number }) => (
    <div data-testid="card-skeleton">Loading skeleton ({lines} lines)</div>
  ),
}));

// Mock metadata-limits
vi.mock("@/lib/metadata-limits", () => ({
  getMetadataLimits: () => ({
    name: { max: 70 },
    appCardSubtitle: { max: 80 },
    appIntroduction: { max: 170 },
    appDetails: { max: 4000 },
    seoTitle: { max: 70 },
    seoMetaDescription: { max: 320 },
  }),
}));

import ComparePage from "@/app/(dashboard)/[platform]/apps/[slug]/compare/page";

describe("ComparePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useParams).mockReturnValue({
      platform: "shopify",
      slug: "test-app",
    });
    // Mock localStorage
    Storage.prototype.getItem = vi.fn(() => null);
    Storage.prototype.setItem = vi.fn();
  });

  it("shows loading skeleton initially", () => {
    // fetchWithAuth never resolves → stays in loading
    mockFetchWithAuth.mockReturnValue(new Promise(() => {}));
    render(<ComparePage />);
    const skeletons = screen.getAllByTestId("card-skeleton");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows app not found when app fetch fails", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/api/apps/")) {
        return Promise.resolve({ ok: false, status: 404 });
      }
      if (url.includes("/competitors")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });
    render(<ComparePage />);
    await waitFor(() => {
      expect(screen.getByText("App not found.")).toBeInTheDocument();
    });
  });

  it("shows no competitors message when app has none", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/api/apps/") && !url.includes("competitors") && !url.includes("rankings")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              slug: "test-app",
              name: "Test App",
              iconUrl: null,
              appCardSubtitle: null,
              latestSnapshot: null,
            }),
        });
      }
      if (url.includes("/competitors") && !url.includes("reorder")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ categoryRankings: [] }),
      });
    });
    render(<ComparePage />);
    await waitFor(() => {
      expect(
        screen.getByText(/No competitors to compare/)
      ).toBeInTheDocument();
    });
  });

  it("calls fetchWithAuth for app and competitors", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/api/apps/") && !url.includes("competitors") && !url.includes("rankings")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              slug: "test-app",
              name: "Test App",
              iconUrl: null,
              appCardSubtitle: null,
              latestSnapshot: null,
            }),
        });
      }
      if (url.includes("/competitors") && !url.includes("reorder")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ categoryRankings: [] }),
      });
    });
    render(<ComparePage />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/api/apps/test-app"
      );
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/api/account/tracked-apps/test-app/competitors?fields=basic"
      );
    });
  });

  it("renders competitor selector when competitors exist", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/api/apps/test-app") && !url.includes("competitors") && !url.includes("rankings")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              slug: "test-app",
              name: "Test App",
              iconUrl: null,
              appCardSubtitle: "Test subtitle",
              latestSnapshot: {
                appIntroduction: "Test intro",
                appDetails: "Test details",
                features: ["Feature A"],
                languages: [],
                integrations: [],
                pricingPlans: [],
                categories: [],
                seoTitle: "",
                seoMetaDescription: "",
                averageRating: "4.5",
                ratingCount: 100,
              },
            }),
        });
      }
      if (url.includes("/competitors") && !url.includes("reorder")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                appSlug: "comp-app",
                appName: "Competitor App",
                iconUrl: null,
              },
            ]),
        });
      }
      if (url.includes("/api/apps/comp-app") && !url.includes("rankings")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              slug: "comp-app",
              name: "Competitor App",
              iconUrl: null,
              appCardSubtitle: "Comp subtitle",
              latestSnapshot: {
                appIntroduction: "Comp intro",
                appDetails: "Comp details",
                features: ["Feature B"],
                languages: [],
                integrations: [],
                pricingPlans: [],
                categories: [],
                seoTitle: "",
                seoMetaDescription: "",
                averageRating: "4.0",
                ratingCount: 50,
              },
            }),
        });
      }
      if (url.includes("/rankings")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ categoryRankings: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
    render(<ComparePage />);
    await waitFor(() => {
      // When all competitors are selected by default, "Deselect all" is shown
      expect(screen.getByText("Deselect all")).toBeInTheDocument();
    });
  });

  it("renders select/deselect toggle", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/api/apps/test-app") && !url.includes("competitors") && !url.includes("rankings")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              slug: "test-app",
              name: "Test App",
              iconUrl: null,
              appCardSubtitle: null,
              latestSnapshot: {
                appIntroduction: "",
                appDetails: "",
                features: [],
                languages: [],
                integrations: [],
                pricingPlans: [],
                categories: [],
                seoTitle: "",
                seoMetaDescription: "",
                averageRating: null,
                ratingCount: null,
              },
            }),
        });
      }
      if (url.includes("/competitors") && !url.includes("reorder")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                appSlug: "comp-1",
                appName: "Comp 1",
                iconUrl: null,
              },
            ]),
        });
      }
      if (url.includes("/rankings")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ categoryRankings: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            slug: "comp-1",
            name: "Comp 1",
            iconUrl: null,
            appCardSubtitle: null,
            latestSnapshot: null,
          }),
      });
    });
    render(<ComparePage />);
    await waitFor(() => {
      expect(screen.getByText("Deselect all")).toBeInTheDocument();
    });
  });

  it("renders section navigation when competitors selected", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/api/apps/test-app") && !url.includes("competitors") && !url.includes("rankings")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              slug: "test-app",
              name: "Test App",
              iconUrl: null,
              appCardSubtitle: null,
              latestSnapshot: {
                appIntroduction: "intro",
                appDetails: "details",
                features: ["Feature A"],
                languages: [],
                integrations: [],
                pricingPlans: [],
                categories: [],
                seoTitle: "seo",
                seoMetaDescription: "seo desc",
                averageRating: "4.5",
                ratingCount: 100,
              },
            }),
        });
      }
      if (url.includes("/competitors") && !url.includes("reorder")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { appSlug: "comp-1", appName: "Comp 1", iconUrl: null },
            ]),
        });
      }
      if (url.includes("/api/apps/comp-1") && !url.includes("rankings")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              slug: "comp-1",
              name: "Comp 1",
              iconUrl: null,
              appCardSubtitle: null,
              latestSnapshot: {
                appIntroduction: "comp intro",
                appDetails: "comp details",
                features: ["Feature B"],
                languages: [],
                integrations: [],
                pricingPlans: [],
                categories: [],
                seoTitle: "",
                seoMetaDescription: "",
                averageRating: "3.5",
                ratingCount: 20,
              },
            }),
        });
      }
      if (url.includes("/rankings")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ categoryRankings: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
    render(<ComparePage />);
    await waitFor(() => {
      expect(screen.getByText("Name")).toBeInTheDocument();
    });
  });

  it("renders section headings for comparison", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/api/apps/test-app") && !url.includes("competitors") && !url.includes("rankings")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              slug: "test-app",
              name: "Test App",
              iconUrl: null,
              appCardSubtitle: null,
              latestSnapshot: {
                appIntroduction: "intro",
                appDetails: "details",
                features: ["Feature A"],
                languages: [],
                integrations: [],
                pricingPlans: [],
                categories: [],
                seoTitle: "seo",
                seoMetaDescription: "desc",
                averageRating: "4.5",
                ratingCount: 100,
              },
            }),
        });
      }
      if (url.includes("/competitors") && !url.includes("reorder")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { appSlug: "comp-1", appName: "Comp 1", iconUrl: null },
            ]),
        });
      }
      if (url.includes("/api/apps/comp-1") && !url.includes("rankings")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              slug: "comp-1",
              name: "Comp 1",
              iconUrl: null,
              appCardSubtitle: null,
              latestSnapshot: {
                appIntroduction: "comp intro",
                appDetails: "comp details",
                features: [],
                languages: [],
                integrations: [],
                pricingPlans: [],
                categories: [],
                seoTitle: "",
                seoMetaDescription: "",
                averageRating: null,
                ratingCount: null,
              },
            }),
        });
      }
      if (url.includes("/rankings")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ categoryRankings: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
    render(<ComparePage />);
    await waitFor(() => {
      // Section headings should be rendered
      expect(screen.getByText("Introduction")).toBeInTheDocument();
    });
  });
});
