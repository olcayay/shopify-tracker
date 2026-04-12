import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetAppRankings = vi.fn();

vi.mock("@/lib/api", () => ({
  getEnabledFeatures: vi.fn().mockResolvedValue([]),
  getAppRankings: (...args: any[]) => mockGetAppRankings(...args),
}));

vi.mock("@/lib/format-date", () => ({
  formatDateOnly: (d: string) => new Date(d).toLocaleDateString(),
}));

vi.mock("@/lib/platform-urls", () => ({
  formatCategoryTitle: (_p: string, slug: string, title: string) => title || slug,
}));

vi.mock("@/components/ranking-chart", () => ({
  RankingChart: ({ data }: any) => (
    <div data-testid="ranking-chart">{data.length} entries</div>
  ),
}));

vi.mock("@/components/data-freshness", () => ({
  DataFreshness: ({ dateStr }: any) => (
    <div data-testid="data-freshness">{dateStr || "none"}</div>
  ),
}));

vi.mock("@/components/ui/date-range-picker", () => ({
  DateRangePicker: () => <div data-testid="rankings-date-picker" />,
}));

import V2RankingsPage from "@/app/(dashboard)/[platform]/apps/v2/[slug]/visibility/rankings/page";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((el) => render(el));
}

const params = Promise.resolve({ platform: "shopify", slug: "test-app" });
const emptySearchParams = Promise.resolve({});

describe("V2RankingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'No ranking data yet' when no rankings", async () => {
    mockGetAppRankings.mockResolvedValue({});
    await renderAsync(V2RankingsPage({ params, searchParams: emptySearchParams }));
    expect(screen.getByText(/No ranking data yet/)).toBeInTheDocument();
  });

  it("renders Category Rankings card when data exists", async () => {
    mockGetAppRankings.mockResolvedValue({
      categoryRankings: [
        { categorySlug: "tools", categoryTitle: "Tools", position: 5, scrapedAt: "2026-04-01" },
      ],
      keywordRankings: [],
    });
    await renderAsync(V2RankingsPage({ params, searchParams: emptySearchParams }));
    expect(screen.getByText("Category Rankings")).toBeInTheDocument();
  });

  it("renders Keyword Rankings card when data exists", async () => {
    mockGetAppRankings.mockResolvedValue({
      categoryRankings: [],
      keywordRankings: [
        { keyword: "pos", keywordSlug: "pos", position: 3, scrapedAt: "2026-04-01" },
      ],
    });
    await renderAsync(V2RankingsPage({ params, searchParams: emptySearchParams }));
    expect(screen.getByText("Keyword Rankings")).toBeInTheDocument();
  });

  it("renders DataFreshness component", async () => {
    mockGetAppRankings.mockResolvedValue({
      categoryRankings: [
        { categorySlug: "tools", categoryTitle: "Tools", position: 5, scrapedAt: "2026-03-20" },
      ],
      keywordRankings: [],
    });
    await renderAsync(V2RankingsPage({ params, searchParams: emptySearchParams }));
    expect(screen.getByTestId("data-freshness")).toBeInTheDocument();
  });

  it("calls getAppRankings with correct params", async () => {
    mockGetAppRankings.mockResolvedValue({});
    await renderAsync(V2RankingsPage({ params, searchParams: emptySearchParams }));
    expect(mockGetAppRankings).toHaveBeenCalledWith("test-app", 30, "shopify");
  });

  it("handles API error gracefully (shows no data message)", async () => {
    mockGetAppRankings.mockRejectedValue(new Error("fail"));
    await renderAsync(V2RankingsPage({ params, searchParams: emptySearchParams }));
    expect(screen.getByText(/No ranking data yet/)).toBeInTheDocument();
  });

  it("renders ranking chart with correct entry count", async () => {
    mockGetAppRankings.mockResolvedValue({
      categoryRankings: [],
      keywordRankings: [
        { keyword: "pos", keywordSlug: "pos", position: 3, scrapedAt: "2026-04-01" },
        { keyword: "checkout", keywordSlug: "checkout", position: 7, scrapedAt: "2026-04-01" },
      ],
    });
    await renderAsync(V2RankingsPage({ params, searchParams: emptySearchParams }));
    expect(screen.getByText("2 entries")).toBeInTheDocument();
  });

  it("renders the shared rankings date picker", async () => {
    mockGetAppRankings.mockResolvedValue({});
    await renderAsync(V2RankingsPage({ params, searchParams: emptySearchParams }));
    expect(screen.getByTestId("rankings-date-picker")).toBeInTheDocument();
  });

  it("uses the selected preset days from search params", async () => {
    mockGetAppRankings.mockResolvedValue({});
    await renderAsync(
      V2RankingsPage({
        params,
        searchParams: Promise.resolve({ days: "90" }),
      })
    );
    expect(mockGetAppRankings).toHaveBeenCalledWith("test-app", 90, "shopify");
  });
});
