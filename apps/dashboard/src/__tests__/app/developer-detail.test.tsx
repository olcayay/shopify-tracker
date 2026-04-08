import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { mockAuthContext } from "../test-utils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/developer/jotform",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ slug: "jotform" }),
}));

const mockFetchWithAuth = vi.fn();
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ ...mockAuthContext, fetchWithAuth: mockFetchWithAuth }),
}));

vi.mock("@/components/skeletons", () => ({
  TableSkeleton: () => <div data-testid="table-skeleton">Loading...</div>,
}));

vi.mock("@/lib/platform-display", () => ({
  getPlatformLabel: (p: string) => p.charAt(0).toUpperCase() + p.slice(1),
  getPlatformColor: () => "#333",
}));

vi.mock("@/lib/format-utils", () => ({
  formatNumber: (n: number) => String(n),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

import CrossPlatformDeveloperPage from "@/app/(dashboard)/developer/[slug]/page";

const mockDeveloper = {
  developer: { id: 1, slug: "jotform", name: "Jotform", website: "https://jotform.com" },
  platforms: [
    { id: 1, platform: "shopify", name: "Shopify", appCount: 2 },
    { id: 2, platform: "wix", name: "Wix", appCount: 1 },
  ],
  apps: [
    { id: 1, platform: "shopify", slug: "jotform-app", name: "Jotform", iconUrl: null, averageRating: 4.5, ratingCount: 100, pricingHint: "Free", isTracked: true, activeInstalls: null },
    { id: 2, platform: "shopify", slug: "jotform-forms", name: "Jotform Forms", iconUrl: null, averageRating: 4.0, ratingCount: 50, pricingHint: "$10/mo", isTracked: false, activeInstalls: null },
    { id: 3, platform: "wix", slug: "jotform-wix", name: "Jotform for Wix", iconUrl: null, averageRating: 3.5, ratingCount: 20, pricingHint: "Free", isTracked: false, activeInstalls: null },
  ],
  totalApps: 3,
  isStarred: false,
};

function makeJsonResponse(data: any) {
  return { ok: true, json: async () => data };
}

describe("CrossPlatformDeveloperPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithAuth.mockResolvedValue(makeJsonResponse(mockDeveloper));
  });

  it("renders developer name and platform badges", async () => {
    render(<CrossPlatformDeveloperPage />);
    await waitFor(() => {
      // Developer heading
      expect(screen.getByRole("heading", { name: "Jotform" })).toBeInTheDocument();
      // Platform badges in summary
      expect(screen.getByText(/3 apps/)).toBeInTheDocument();
      expect(screen.getByText(/2 platforms/)).toBeInTheDocument();
    });
  });

  it("renders apps in platform cards", async () => {
    render(<CrossPlatformDeveloperPage />);
    await waitFor(() => {
      expect(screen.getByText("Jotform Forms")).toBeInTheDocument();
      expect(screen.getByText("Jotform for Wix")).toBeInTheDocument();
    });
  });

  it("renders platform card headers with app counts", async () => {
    render(<CrossPlatformDeveloperPage />);
    await waitFor(() => {
      // Platform cards show app counts in parentheses
      expect(screen.getByText(/2 apps/)).toBeInTheDocument();
      expect(screen.getByText(/1 app/)).toBeInTheDocument();
    });
  });

  it("renders app table with rating and pricing columns", async () => {
    render(<CrossPlatformDeveloperPage />);
    await waitFor(() => {
      // "Jotform" appears in heading and app table — use getAllByText
      expect(screen.getAllByText("Jotform").length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText("Jotform Forms")).toBeInTheDocument();
      expect(screen.getByText("Jotform for Wix")).toBeInTheDocument();
      // Rating values
      expect(screen.getByText("4.5")).toBeInTheDocument();
      expect(screen.getByText("4.0")).toBeInTheDocument();
    });
  });

  it("shows all platform apps without collapsing", async () => {
    render(<CrossPlatformDeveloperPage />);
    await waitFor(() => {
      // All apps from all platforms should be visible simultaneously
      expect(screen.getByText("Jotform Forms")).toBeInTheDocument(); // Shopify
      expect(screen.getByText("Jotform for Wix")).toBeInTheDocument(); // Wix
    });
  });
});
