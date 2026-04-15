import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
  usePathname: () => "/developer/acme-inc",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ slug: "acme-inc" }),
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

import CrossPlatformDeveloperPage from "@/app/(dashboard)/developer/[slug]/page";

function makeJsonResponse(data: any) {
  return { ok: true, json: () => Promise.resolve(data) };
}

const baseDeveloper = {
  developer: {
    id: 1,
    slug: "acme-inc",
    name: "Acme Inc",
    website: "https://acme.com",
  },
};

describe("CrossPlatformDeveloperPage — unified columns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      ...mockAuthContext,
      fetchWithAuth: mockFetchWithAuth,
    });
  });

  it("shows Installs column for ALL platforms when any platform has install data", async () => {
    // Shopify has installs, Salesforce does not
    mockFetchWithAuth.mockResolvedValueOnce(
      makeJsonResponse({
        ...baseDeveloper,
        platforms: [
          { id: 1, platform: "shopify", name: "Shopify", appCount: 1 },
          { id: 2, platform: "salesforce", name: "Salesforce", appCount: 1 },
        ],
        apps: [
          {
            id: 1,
            platform: "shopify",
            slug: "app-a",
            name: "App A",
            iconUrl: null,
            averageRating: 4.5,
            ratingCount: 100,
            pricingHint: "Free",
            isTracked: false,
            activeInstalls: 5000,
          },
          {
            id: 2,
            platform: "salesforce",
            slug: "app-b",
            name: "App B",
            iconUrl: null,
            averageRating: 3.0,
            ratingCount: 50,
            pricingHint: "Paid",
            isTracked: false,
            activeInstalls: null,
          },
        ],
        totalApps: 2,
      })
    );

    render(<CrossPlatformDeveloperPage />);

    await waitFor(() => {
      expect(screen.getByText("App A")).toBeInTheDocument();
    });

    // Both tables should have Installs column headers
    const installHeaders = screen.getAllByText("Installs");
    expect(installHeaders).toHaveLength(2);

    // Shopify app should show installs value
    const shopifyRow = screen.getByText("App A").closest("tr")!;
    const shopifyCells = shopifyRow.querySelectorAll("td");
    expect(shopifyCells[shopifyCells.length - 1].textContent).toMatch(/5[\s,.]?000/);

    // Salesforce app should show "-" for installs (no install data)
    const salesforceRow = screen.getByText("App B").closest("tr")!;
    const cells = salesforceRow.querySelectorAll("td");
    expect(cells[cells.length - 1].textContent).toBe("-");
  });

  it("hides Installs column for ALL platforms when no platform has install data", async () => {
    mockFetchWithAuth.mockResolvedValueOnce(
      makeJsonResponse({
        ...baseDeveloper,
        platforms: [
          { id: 1, platform: "shopify", name: "Shopify", appCount: 1 },
          { id: 2, platform: "salesforce", name: "Salesforce", appCount: 1 },
        ],
        apps: [
          {
            id: 1,
            platform: "shopify",
            slug: "app-a",
            name: "App A",
            iconUrl: null,
            averageRating: 4.5,
            ratingCount: 100,
            pricingHint: "Free",
            isTracked: false,
            activeInstalls: null,
          },
          {
            id: 2,
            platform: "salesforce",
            slug: "app-b",
            name: "App B",
            iconUrl: null,
            averageRating: 3.0,
            ratingCount: 50,
            pricingHint: "Paid",
            isTracked: false,
            activeInstalls: null,
          },
        ],
        totalApps: 2,
      })
    );

    render(<CrossPlatformDeveloperPage />);

    await waitFor(() => {
      expect(screen.getByText("App A")).toBeInTheDocument();
    });

    // No Installs column headers should exist
    expect(screen.queryAllByText("Installs")).toHaveLength(0);
  });

  it("all platform tables have same number of columns", async () => {
    mockFetchWithAuth.mockResolvedValueOnce(
      makeJsonResponse({
        ...baseDeveloper,
        platforms: [
          { id: 1, platform: "shopify", name: "Shopify", appCount: 1 },
          { id: 2, platform: "salesforce", name: "Salesforce", appCount: 1 },
          { id: 3, platform: "wix", name: "Wix", appCount: 1 },
        ],
        apps: [
          {
            id: 1,
            platform: "shopify",
            slug: "app-a",
            name: "App A",
            iconUrl: null,
            averageRating: 4.5,
            ratingCount: 100,
            pricingHint: "Free",
            isTracked: false,
            activeInstalls: 1000,
          },
          {
            id: 2,
            platform: "salesforce",
            slug: "app-b",
            name: "App B",
            iconUrl: null,
            averageRating: null,
            ratingCount: null,
            pricingHint: null,
            isTracked: false,
            activeInstalls: null,
          },
          {
            id: 3,
            platform: "wix",
            slug: "app-c",
            name: "App C",
            iconUrl: null,
            averageRating: 5.0,
            ratingCount: 10,
            pricingHint: "Free",
            isTracked: true,
            activeInstalls: null,
          },
        ],
        totalApps: 3,
      })
    );

    render(<CrossPlatformDeveloperPage />);

    await waitFor(() => {
      expect(screen.getByText("App A")).toBeInTheDocument();
    });

    // All header rows should have same column count
    const tables = document.querySelectorAll("table");
    expect(tables.length).toBe(3);
    const headerRows = document.querySelectorAll("thead tr");
    expect(headerRows.length).toBe(3);
    const colCounts = Array.from(headerRows).map(
      (row) => row.querySelectorAll("th").length
    );
    expect(colCounts[0]).toBe(colCounts[1]);
    expect(colCounts[1]).toBe(colCounts[2]);
  });

  it("shows dash placeholders for missing data", async () => {
    mockFetchWithAuth.mockResolvedValueOnce(
      makeJsonResponse({
        ...baseDeveloper,
        platforms: [
          { id: 1, platform: "shopify", name: "Shopify", appCount: 1 },
        ],
        apps: [
          {
            id: 1,
            platform: "shopify",
            slug: "app-a",
            name: "App A",
            iconUrl: null,
            averageRating: null,
            ratingCount: null,
            pricingHint: null,
            isTracked: false,
            activeInstalls: null,
          },
        ],
        totalApps: 1,
      })
    );

    render(<CrossPlatformDeveloperPage />);

    await waitFor(() => {
      expect(screen.getByText("App A")).toBeInTheDocument();
    });

    // Rating and Reviews show hyphen; Pricing shows em-dash (PLA-1109
    // canonical placeholder via displayPricingModel).
    const row = screen.getByText("App A").closest("tr")!;
    const cells = row.querySelectorAll("td");
    // cells: App, Rating, Reviews, Pricing (no Installs since none have it)
    expect(cells[1].textContent).toBe("-");
    expect(cells[2].textContent).toBe("-");
    expect(cells[3].textContent).toBe("\u2014");
  });
});
