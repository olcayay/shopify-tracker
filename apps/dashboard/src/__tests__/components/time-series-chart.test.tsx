import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimeSeriesChart } from "@/components/ui/time-series-chart";

// Mock recharts to avoid canvas/SVG issues in tests
vi.mock("recharts", () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  Legend: () => null,
}));

const mockData = [
  { time: "2026-04-08T10:00:00Z", daily_digest: 5, ranking_alert: 3 },
  { time: "2026-04-08T11:00:00Z", daily_digest: 8, ranking_alert: 1 },
  { time: "2026-04-08T12:00:00Z", daily_digest: 2, ranking_alert: 6 },
];

const mockSeries = [
  { key: "daily_digest", label: "Daily Digest", color: "#3b82f6" },
  { key: "ranking_alert", label: "Ranking Alert", color: "#ef4444" },
];

describe("TimeSeriesChart", () => {
  it("renders chart container", () => {
    render(<TimeSeriesChart data={mockData} series={mockSeries} />);
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("renders legend with series labels", () => {
    render(<TimeSeriesChart data={mockData} series={mockSeries} />);
    expect(screen.getByText("Daily Digest")).toBeInTheDocument();
    expect(screen.getByText("Ranking Alert")).toBeInTheDocument();
  });

  it("renders time range selector when provided", () => {
    const onRangeChange = vi.fn();
    render(
      <TimeSeriesChart
        data={mockData}
        series={mockSeries}
        timeRanges={["12h", "24h", "48h"]}
        selectedRange="24h"
        onRangeChange={onRangeChange}
      />
    );
    expect(screen.getByText("12h")).toBeInTheDocument();
    expect(screen.getByText("24h")).toBeInTheDocument();
    expect(screen.getByText("48h")).toBeInTheDocument();
  });

  it("calls onRangeChange when time range button clicked", () => {
    const onRangeChange = vi.fn();
    render(
      <TimeSeriesChart
        data={mockData}
        series={mockSeries}
        timeRanges={["12h", "24h"]}
        selectedRange="24h"
        onRangeChange={onRangeChange}
      />
    );
    fireEvent.click(screen.getByText("12h"));
    expect(onRangeChange).toHaveBeenCalledWith("12h");
  });

  it("toggles series visibility when legend item clicked", () => {
    render(<TimeSeriesChart data={mockData} series={mockSeries} />);
    const digestButton = screen.getByText("Daily Digest");
    fireEvent.click(digestButton);
    // After toggling, the button should have opacity/line-through
    expect(digestButton.closest("button")).toHaveClass("opacity-40");
  });

  it("does not render time range selector when not provided", () => {
    render(<TimeSeriesChart data={mockData} series={mockSeries} />);
    expect(screen.queryByText("12h")).not.toBeInTheDocument();
  });
});
