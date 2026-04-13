import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

import { RankingChart, computeTooltipX } from "@/components/ranking-chart";

describe("computeTooltipX", () => {
  it("places tooltip to the right of cursor when there is room", () => {
    expect(computeTooltipX(100, 1000, 420, 16)).toBe(116);
  });

  it("flips tooltip to the left of cursor when right would overflow", () => {
    // cursorX 800, container 1000, tooltip 420, gap 16 -> right edge would be
    // 800 + 16 + 420 = 1236 > 1000 -> flip to 800 - 16 - 420 = 364
    expect(computeTooltipX(800, 1000, 420, 16)).toBe(364);
  });

  it("clamps to 0 when flipping left would go off-screen", () => {
    expect(computeTooltipX(50, 200, 420, 16)).toBe(0);
  });

  it("falls back to right of cursor when container width is unknown", () => {
    expect(computeTooltipX(100, 0)).toBe(116);
  });
});

const mockData = [
  { date: "2026-01-01", position: 5, label: "My App", slug: "my-app", linkPrefix: "/shopify/apps/" },
  { date: "2026-01-08", position: 3, label: "My App", slug: "my-app", linkPrefix: "/shopify/apps/" },
  { date: "2026-01-01", position: 10, label: "Competitor", slug: "comp", linkPrefix: "/shopify/apps/" },
  { date: "2026-01-08", position: 12, label: "Competitor", slug: "comp", linkPrefix: "/shopify/apps/" },
];

describe("RankingChart", () => {
  it("renders the chart container", () => {
    render(<RankingChart data={mockData} />);
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("shows 'No data available.' for empty data", () => {
    render(<RankingChart data={[]} />);
    expect(screen.getByText("No data available.")).toBeInTheDocument();
  });

  it("renders the ranking table with headers", () => {
    render(<RankingChart data={mockData} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Position")).toBeInTheDocument();
    expect(screen.getByText("Page")).toBeInTheDocument();
    expect(screen.getByText("Change")).toBeInTheDocument();
  });

  it("renders app names in the table", () => {
    render(<RankingChart data={mockData} />);
    expect(screen.getByText("My App")).toBeInTheDocument();
    expect(screen.getByText("Competitor")).toBeInTheDocument();
  });

  it("renders position values", () => {
    render(<RankingChart data={mockData} />);
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("#12")).toBeInTheDocument();
  });

  it("renders change indicator for improved position", () => {
    render(<RankingChart data={mockData} />);
    // My App: went from 5 -> 3 = change of +2
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("renders negative change for worsened position", () => {
    render(<RankingChart data={mockData} />);
    // Competitor: went from 10 -> 12 = change of -2
    expect(screen.getByText("-2")).toBeInTheDocument();
  });

  it("renders page numbers based on position", () => {
    render(<RankingChart data={mockData} pageSize={24} />);
    // Position 3 -> page 1, Position 12 -> page 1
    const pageCells = screen.getAllByText("p1");
    expect(pageCells.length).toBe(2);
  });

  it("shows 'Dropped' for apps with null position on latest date", () => {
    const droppedData = [
      { date: "2026-01-01", position: 5, label: "Dropped App" },
      { date: "2026-01-08", position: null, label: "Dropped App" },
    ];
    render(<RankingChart data={droppedData} />);
    expect(screen.getByText("Dropped")).toBeInTheDocument();
  });

  it("toggles line visibility when clicking a row", async () => {
    const user = userEvent.setup();
    render(<RankingChart data={mockData} />);

    const myAppRow = screen.getByText("My App").closest("tr");
    expect(myAppRow).not.toBeNull();

    await user.click(myAppRow!);

    // After clicking, the row should have reduced opacity
    expect(myAppRow!.className).toContain("opacity-40");
  });
});
