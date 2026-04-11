import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { REVIEW_TREND_DATE_RANGE_STORAGE_KEY } from "@/lib/review-trend-date-range";

const mockReplace = vi.fn();
let mockPathname = "/shopify/apps/test-app/reviews";
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
  useParams: () => ({}),
}));

import { ReviewTrendDatePicker } from "@/components/review-trend-date-picker";

describe("ReviewTrendDatePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockPathname = "/shopify/apps/test-app/reviews";
    mockSearchParams = new URLSearchParams();
  });

  it("renders all preset options", () => {
    render(<ReviewTrendDatePicker />);

    expect(screen.getByRole("button", { name: "Last month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last 3 months" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last 6 months" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last year" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Custom range/ })).toBeInTheDocument();
  });

  it("updates the URL and localStorage when a preset is selected", async () => {
    render(<ReviewTrendDatePicker />);

    fireEvent.click(screen.getByRole("button", { name: "Last 6 months" }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/shopify/apps/test-app/reviews?trendDays=180");
    });
    expect(localStorage.getItem(REVIEW_TREND_DATE_RANGE_STORAGE_KEY)).toContain("\"preset\":\"180d\"");
  });

  it("validates custom ranges before applying them", async () => {
    render(<ReviewTrendDatePicker />);

    fireEvent.click(screen.getByRole("button", { name: /Custom range/ }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-10" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-03-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply range" }));

    expect(await screen.findByText("Start date must be on or before the end date.")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("applies a custom range to the URL and localStorage", async () => {
    render(<ReviewTrendDatePicker />);

    fireEvent.click(screen.getByRole("button", { name: /Custom range/ }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-02-10" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-02-28" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply range" }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/shopify/apps/test-app/reviews?trendFrom=2026-02-10&trendTo=2026-02-28"
      );
    });
    expect(localStorage.getItem(REVIEW_TREND_DATE_RANGE_STORAGE_KEY)).toContain("\"preset\":\"custom\"");
  });

  it("restores the saved selection from localStorage when the URL has no explicit params", async () => {
    localStorage.setItem(
      REVIEW_TREND_DATE_RANGE_STORAGE_KEY,
      JSON.stringify({
        preset: "180d",
        from: "2025-10-14",
        to: "2026-04-11",
        days: 180,
      })
    );

    render(<ReviewTrendDatePicker />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/shopify/apps/test-app/reviews?trendDays=180");
    });
  });
});
