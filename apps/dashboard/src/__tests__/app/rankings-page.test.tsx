import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetAppRankings = vi.fn();

vi.mock("@/lib/api", () => ({
  getAppRankings: (...args: any[]) => mockGetAppRankings(...args),
}));

vi.mock("@/lib/format-date", () => ({
  formatDateOnly: (value: string) => value,
}));

vi.mock("@/lib/platform-urls", () => ({
  formatCategoryTitle: (_platform: string, slug: string, title: string) => title || slug,
}));

vi.mock("@/components/ranking-chart", () => ({
  RankingChart: ({ data }: any) => <div data-testid="ranking-chart">{data.length} entries</div>,
}));

vi.mock("@/components/ad-heatmap", () => ({
  AdHeatmap: ({ sightings }: any) => <div data-testid="ad-heatmap">{sightings.length} sightings</div>,
}));

vi.mock("@/components/data-freshness", () => ({
  DataFreshness: ({ dateStr }: any) => <div data-testid="data-freshness">{dateStr || "none"}</div>,
}));

vi.mock("@/components/ui/date-range-picker", () => ({
  DateRangePicker: () => <div data-testid="rankings-date-picker" />,
}));

import RankingsPage from "@/app/(dashboard)/[platform]/apps/[slug]/rankings/page";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((element) => render(element));
}

describe("RankingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-11T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the shared picker and default 30-day rankings", async () => {
    mockGetAppRankings.mockResolvedValue({});

    await renderAsync(
      RankingsPage({
        params: Promise.resolve({ platform: "shopify", slug: "ranked-app" }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(screen.getByTestId("rankings-date-picker")).toBeInTheDocument();
    expect(mockGetAppRankings).toHaveBeenCalledWith("ranked-app", 30, "shopify");
  });

  it("filters custom date ranges after fetching enough history", async () => {
    mockGetAppRankings.mockResolvedValue({
      categoryRankings: [
        { categorySlug: "forms", categoryTitle: "Forms", position: 1, scrapedAt: "2026-02-15T00:00:00Z" },
        { categorySlug: "forms", categoryTitle: "Forms", position: 2, scrapedAt: "2026-02-05T00:00:00Z" },
      ],
      keywordRankings: [
        { keyword: "forms", keywordSlug: "forms", position: 3, scrapedAt: "2026-02-20T00:00:00Z" },
        { keyword: "forms", keywordSlug: "forms", position: 4, scrapedAt: "2026-03-20T00:00:00Z" },
      ],
      keywordAds: [
        { keyword: "forms", keywordSlug: "forms", seenDate: "2026-02-21", timesSeenInDay: 2 },
        { keyword: "forms", keywordSlug: "forms", seenDate: "2026-03-28", timesSeenInDay: 5 },
      ],
    });

    await renderAsync(
      RankingsPage({
        params: Promise.resolve({ platform: "shopify", slug: "ranked-app" }),
        searchParams: Promise.resolve({ from: "2026-02-10", to: "2026-02-28" }),
      })
    );

    expect(mockGetAppRankings).toHaveBeenCalledWith("ranked-app", 61, "shopify");
    expect(screen.getByText("Category Rankings")).toBeInTheDocument();
    expect(screen.getByText("Keyword Rankings")).toBeInTheDocument();
    expect(screen.getAllByTestId("ranking-chart")).toHaveLength(2);
    expect(screen.getByText("1 sightings")).toBeInTheDocument();
  });
});
