// PLA-1079: My/Competitor Developers sections must show a shimmer while
// loading, not the empty-state CTA. This test covers the 3 states:
// pending → skeleton, resolved-empty → empty CTA, resolved-with-data → list.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { mockAccount, mockAuthContext } from "../test-utils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/shopify/developers",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ platform: "shopify" }),
}));

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
  },
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
}));

import PlatformDevelopersPage from "@/app/(dashboard)/[platform]/developers/page";

function makeJsonResponse(data: any) {
  return { ok: true, json: () => Promise.resolve(data) };
}

function setupFetchMocks(opts: {
  tracked?: any[];
  competitor?: any[];
  mainDevelopers?: any[];
} = {}) {
  mockFetchWithAuth.mockImplementation((url: string) => {
    if (url.includes("/api/developers/tracked")) {
      return Promise.resolve(makeJsonResponse({ developers: opts.tracked ?? [] }));
    }
    if (url.includes("/api/developers/competitors")) {
      return Promise.resolve(makeJsonResponse({ developers: opts.competitor ?? [] }));
    }
    if (url.includes("/api/developers")) {
      return Promise.resolve(
        makeJsonResponse({
          developers: opts.mainDevelopers ?? [],
          pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
        })
      );
    }
    return Promise.resolve(makeJsonResponse(null));
  });
}

describe("PlatformDevelopersPage loading states (PLA-1079)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockUseAuth.mockReturnValue({
      ...mockAuthContext,
      account: { ...mockAccount, enabledPlatforms: ["shopify"] },
      fetchWithAuth: mockFetchWithAuth,
    });
  });

  it("shows skeletons (not empty-state CTAs) while fetches are pending", () => {
    mockFetchWithAuth.mockImplementation(() => new Promise(() => {}));
    render(<PlatformDevelopersPage />);
    // Section headers stay visible — avoids layout jump.
    expect(screen.getByText("My Developers")).toBeInTheDocument();
    expect(screen.getByText("Competitor Developers")).toBeInTheDocument();
    // Skeletons present.
    expect(screen.getAllByTestId("table-skeleton").length).toBeGreaterThanOrEqual(2);
    // Empty-state CTAs must NOT flash.
    expect(screen.queryByText(/No tracked developers/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No competitor developers/)).not.toBeInTheDocument();
    expect(screen.queryByText("Browse Apps")).not.toBeInTheDocument();
    expect(screen.queryByText("View Competitors")).not.toBeInTheDocument();
  });

  it("shows empty state after fetch resolves with no tracked or competitor developers", async () => {
    setupFetchMocks({ tracked: [], competitor: [] });
    render(<PlatformDevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText(/No tracked developers on this platform/)).toBeInTheDocument();
      expect(screen.getByText(/No competitor developers on this platform/)).toBeInTheDocument();
    });
  });

  it("shows tracked developer row when fetch returns a tracked developer", async () => {
    setupFetchMocks({
      tracked: [
        {
          id: 1,
          slug: "acme",
          name: "Acme Co",
          platformCount: 1,
          platforms: ["shopify"],
          totalApps: 4,
          isStarred: false,
          trackedApps: [],
        },
      ],
      competitor: [],
    });
    render(<PlatformDevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Co")).toBeInTheDocument();
    });
    // Empty CTA for tracked section should not appear alongside real data.
    expect(screen.queryByText(/No tracked developers/)).not.toBeInTheDocument();
    // Competitor section still resolves to empty-state CTA.
    expect(screen.getByText(/No competitor developers on this platform/)).toBeInTheDocument();
  });

  it("recovers to empty state when the fetch fails (loading flag cleared)", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/api/developers/tracked")) {
        return Promise.reject(new Error("boom"));
      }
      if (url.includes("/api/developers/competitors")) {
        return Promise.reject(new Error("boom"));
      }
      return Promise.resolve(makeJsonResponse({ developers: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } }));
    });
    render(<PlatformDevelopersPage />);
    await waitFor(() => {
      expect(screen.getByText(/No tracked developers on this platform/)).toBeInTheDocument();
      expect(screen.getByText(/No competitor developers on this platform/)).toBeInTheDocument();
    });
  });
});
