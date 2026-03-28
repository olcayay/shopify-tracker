import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrendBadge } from "@/components/v2/trend-badge";

describe("TrendBadge", () => {
  it("renders value with positive delta", () => {
    render(<TrendBadge value={72} previousValue={69} />);
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("+3")).toBeInTheDocument();
  });

  it("renders value with negative delta", () => {
    render(<TrendBadge value={50} previousValue={55} />);
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("-5")).toBeInTheDocument();
  });

  it("renders dash for null value", () => {
    render(<TrendBadge value={null} previousValue={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("handles no previous value", () => {
    render(<TrendBadge value={42} previousValue={null} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("handles zero delta", () => {
    render(<TrendBadge value={50} previousValue={50} />);
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("handles inverted mode (rank: lower is better)", () => {
    render(<TrendBadge value={5} previousValue={8} inverted format="rank" />);
    expect(screen.getByText("#5")).toBeInTheDocument();
    // Delta should show as positive (improvement) since rank went down
    expect(screen.getByText("▲3")).toBeInTheDocument();
  });

  it("shows rank format", () => {
    render(<TrendBadge value={3} previousValue={null} format="rank" />);
    expect(screen.getByText("#3")).toBeInTheDocument();
  });

  it("shows suffix", () => {
    render(<TrendBadge value={12} previousValue={null} suffix="/30d" />);
    expect(screen.getByText("/30d")).toBeInTheDocument();
  });
});
