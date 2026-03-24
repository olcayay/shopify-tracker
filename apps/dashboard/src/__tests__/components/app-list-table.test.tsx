import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupAuthMock } from "../test-utils";

// Mock star-app-button since it uses useAuth internally
vi.mock("@/components/star-app-button", () => ({
  StarAppButton: ({ appSlug }: { appSlug: string }) => (
    <button data-testid={`star-${appSlug}`}>Star</button>
  ),
}));

// Mock format-date hook
vi.mock("@/lib/format-date", () => ({
  useFormatDate: () => ({
    formatDateTime: (d: string) => d,
    formatDateOnly: (d: string) => d,
  }),
}));

const defaultProps = {
  title: "Apps",
  apps: [
    {
      slug: "app-one",
      name: "App One",
      icon_url: "https://example.com/icon1.png",
      average_rating: "4.5",
      rating_count: "100",
      pricing: "Free",
    },
    {
      slug: "app-two",
      name: "App Two",
      icon_url: "https://example.com/icon2.png",
      average_rating: "3.8",
      rating_count: "50",
      pricing: "Paid",
    },
  ],
  trackedSlugs: ["app-one"],
  competitorSlugs: ["app-two"],
  lastChanges: { "app-one": "2026-01-15", "app-two": "2026-01-10" },
  minPaidPrices: { "app-one": 0, "app-two": 9.99 },
  launchedDates: { "app-one": "2025-01-01", "app-two": "2024-06-15" },
  appCategories: {
    "app-one": [{ title: "Category A", slug: "cat-a", position: 3 }],
    "app-two": [{ title: "Category B", slug: "cat-b", position: 10 }],
  },
  reverseSimilarCounts: { "app-one": 5, "app-two": 2 },
  featuredSectionCounts: { "app-one": 3, "app-two": 0 },
  adKeywordCounts: { "app-one": 2, "app-two": 1 },
};

describe("AppListTable", () => {
  beforeEach(() => {
    vi.resetModules();
    setupAuthMock();
    // Mock useParams to return shopify platform
    vi.doMock("next/navigation", async () => {
      const original = await vi.importActual("next/navigation");
      return {
        ...original,
        useParams: () => ({ platform: "shopify" }),
        useRouter: () => ({
          push: vi.fn(),
          replace: vi.fn(),
          refresh: vi.fn(),
          back: vi.fn(),
          prefetch: vi.fn(),
        }),
        usePathname: () => "/shopify/apps",
        useSearchParams: () => new URLSearchParams(),
      };
    });
  });

  async function renderComponent(overrides: Record<string, unknown> = {}) {
    const { AppListTable } = await import("@/components/app-list-table");
    return render(<AppListTable {...defaultProps} {...overrides} />);
  }

  it("renders the title with count", async () => {
    await renderComponent();
    // The CardTitle renders "Apps (2)" — use a matcher that targets the title element
    const title = screen.getByText((content, element) => {
      return element?.getAttribute("data-slot") === "card-title" && content.includes("Apps");
    });
    expect(title).toBeInTheDocument();
    expect(title.textContent).toContain("2");
  });

  it("renders table header with App column", async () => {
    await renderComponent();
    expect(screen.getByText("App")).toBeInTheDocument();
  });

  it("renders Rating column header for platforms with reviews", async () => {
    await renderComponent();
    expect(screen.getByText("Rating")).toBeInTheDocument();
  });

  it("renders Reviews column header for platforms with reviews", async () => {
    await renderComponent();
    expect(screen.getByText("Reviews")).toBeInTheDocument();
  });

  it("renders app names", async () => {
    await renderComponent();
    expect(screen.getByText("App One")).toBeInTheDocument();
    expect(screen.getByText("App Two")).toBeInTheDocument();
  });

  it("renders app icons as images", async () => {
    const { container } = await renderComponent();
    const images = container.querySelectorAll("img");
    expect(images.length).toBeGreaterThanOrEqual(2);
  });

  it("renders rating values", async () => {
    await renderComponent();
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("3.8")).toBeInTheDocument();
  });

  it("renders review counts", async () => {
    await renderComponent();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("shows Tracked badge for tracked apps", async () => {
    await renderComponent();
    expect(screen.getByText("Tracked")).toBeInTheDocument();
  });

  it("shows Competitor badge for competitor apps", async () => {
    await renderComponent();
    expect(screen.getByText("Competitor")).toBeInTheDocument();
  });

  it("shows 'No apps found.' for empty app list", async () => {
    await renderComponent({ apps: [] });
    expect(screen.getByText("No apps found.")).toBeInTheDocument();
  });

  it("renders status filter buttons", async () => {
    await renderComponent();
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText(/Tracked & Competitors/)).toBeInTheDocument();
  });

  it("renders category rank info", async () => {
    await renderComponent();
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("Category A")).toBeInTheDocument();
  });

  it("renders star app buttons", async () => {
    await renderComponent();
    expect(screen.getByTestId("star-app-one")).toBeInTheDocument();
    expect(screen.getByTestId("star-app-two")).toBeInTheDocument();
  });
});
