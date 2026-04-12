import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetAppReviews = vi.fn();
const mockGetAppHistory = vi.fn();

vi.mock("@/lib/api", () => ({
  getApp: vi.fn(),
  getAppReviews: (...args: any[]) => mockGetAppReviews(...args),
  getAppHistory: (...args: any[]) => mockGetAppHistory(...args),
}));

vi.mock("@/components/rating-review-chart", () => ({
  RatingReviewChart: ({ snapshots }: any) => (
    <div data-testid="rating-review-chart">{snapshots.length} snapshots</div>
  ),
}));

vi.mock("@/components/ui/date-range-picker", () => ({
  DateRangePicker: () => <div data-testid="review-trend-date-picker" />,
}));

vi.mock("@/app/(dashboard)/[platform]/apps/[slug]/review-list", () => ({
  ReviewList: ({ appSlug, total }: any) => (
    <div data-testid="review-list">{total} reviews for {appSlug}</div>
  ),
}));

import ReviewsPage from "@/app/(dashboard)/[platform]/apps/[slug]/reviews/page";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((element) => render(element));
}

describe("ReviewsPage", () => {
  const params = Promise.resolve({ platform: "shopify", slug: "test-app" });
  const emptySearchParams = Promise.resolve({});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders review trend controls when enough snapshots exist", async () => {
    mockGetAppReviews.mockResolvedValue({ reviews: [], total: 0, distribution: [] });
    mockGetAppHistory.mockResolvedValue({
      snapshots: [
        { averageRating: 4.5, ratingCount: 10, scrapedAt: "2026-04-01T00:00:00Z" },
        { averageRating: 4.6, ratingCount: 11, scrapedAt: "2026-04-08T00:00:00Z" },
      ],
    });

    await renderAsync(ReviewsPage({ params, searchParams: emptySearchParams }));

    expect(screen.getByText("Rating & Review Trend")).toBeInTheDocument();
    expect(screen.getByTestId("review-trend-date-picker")).toBeInTheDocument();
  });

  it("uses custom trend range params when loading history", async () => {
    mockGetAppReviews.mockResolvedValue({ reviews: [], total: 0, distribution: [] });
    mockGetAppHistory.mockResolvedValue({ snapshots: [] });

    await renderAsync(
      ReviewsPage({
        params,
        searchParams: Promise.resolve({ trendFrom: "2026-02-01", trendTo: "2026-02-28" }),
      })
    );

    expect(mockGetAppHistory).toHaveBeenCalledWith("test-app", 365, "shopify");
  });
});
