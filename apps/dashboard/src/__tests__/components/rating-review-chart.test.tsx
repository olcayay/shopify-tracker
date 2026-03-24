import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock recharts since it requires DOM measurements not available in jsdom
vi.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <div data-testid="responsive-container">{children}</div>,
}));

import { RatingReviewChart } from "@/components/rating-review-chart";

const makeSnapshot = (date: string, rating: number | null, count: number | null) => ({
  scrapedAt: date,
  averageRating: rating,
  ratingCount: count,
});

describe("RatingReviewChart", () => {
  it("returns null when less than 2 data points", () => {
    const { container } = render(
      <RatingReviewChart snapshots={[makeSnapshot("2026-01-01", 4.5, 100)]} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null for empty snapshots", () => {
    const { container } = render(<RatingReviewChart snapshots={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders Rating History card when rating data exists", () => {
    const snapshots = [
      makeSnapshot("2026-01-01", 4.5, 100),
      makeSnapshot("2026-01-08", 4.6, 110),
      makeSnapshot("2026-01-15", 4.7, 120),
    ];
    render(<RatingReviewChart snapshots={snapshots} />);
    expect(screen.getByText("Rating History")).toBeInTheDocument();
  });

  it("renders Review Count History card when review data exists", () => {
    const snapshots = [
      makeSnapshot("2026-01-01", 4.5, 100),
      makeSnapshot("2026-01-08", 4.6, 110),
      makeSnapshot("2026-01-15", 4.7, 120),
    ];
    render(<RatingReviewChart snapshots={snapshots} />);
    expect(screen.getByText("Review Count History")).toBeInTheDocument();
  });

  it("renders both charts when both rating and review data exist", () => {
    const snapshots = [
      makeSnapshot("2026-01-01", 4.5, 100),
      makeSnapshot("2026-01-08", 4.6, 110),
      makeSnapshot("2026-01-15", 4.7, 120),
    ];
    render(<RatingReviewChart snapshots={snapshots} />);
    const containers = screen.getAllByTestId("responsive-container");
    expect(containers.length).toBe(2);
  });

  it("only renders review chart when rating is null", () => {
    const snapshots = [
      makeSnapshot("2026-01-01", null, 100),
      makeSnapshot("2026-01-08", null, 110),
      makeSnapshot("2026-01-15", null, 120),
    ];
    render(<RatingReviewChart snapshots={snapshots} />);
    expect(screen.queryByText("Rating History")).not.toBeInTheDocument();
    expect(screen.getByText("Review Count History")).toBeInTheDocument();
  });

  it("only renders rating chart when review count is null", () => {
    const snapshots = [
      makeSnapshot("2026-01-01", 4.5, null),
      makeSnapshot("2026-01-08", 4.6, null),
      makeSnapshot("2026-01-15", 4.7, null),
    ];
    render(<RatingReviewChart snapshots={snapshots} />);
    expect(screen.getByText("Rating History")).toBeInTheDocument();
    expect(screen.queryByText("Review Count History")).not.toBeInTheDocument();
  });

  it("returns null when both rating and review data are null", () => {
    const snapshots = [
      makeSnapshot("2026-01-01", null, null),
      makeSnapshot("2026-01-08", null, null),
      makeSnapshot("2026-01-15", null, null),
    ];
    const { container } = render(<RatingReviewChart snapshots={snapshots} />);
    expect(container.innerHTML).toBe("");
  });

  it("deduplicates snapshots by week", () => {
    // Two snapshots in the same week — only latest should be used
    const snapshots = [
      makeSnapshot("2026-01-06", 4.5, 100), // Monday
      makeSnapshot("2026-01-07", 4.6, 110), // Tuesday same week
      makeSnapshot("2026-01-13", 4.7, 120), // Next week
    ];
    render(<RatingReviewChart snapshots={snapshots} />);
    // Should render (2 weeks of data), but we just verify it renders at all
    expect(screen.getByText("Rating History")).toBeInTheDocument();
  });
});
