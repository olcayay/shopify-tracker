import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HealthScoreBar } from "@/components/v2/health-score-bar";

describe("HealthScoreBar", () => {
  const defaultProps = {
    visibilityScore: 72,
    visibilityDelta: 3,
    powerScore: 58,
    powerDelta: -2,
    keywordCount: 24,
    avgPosition: 12.4,
    featuredCount: 3,
  };

  it("renders both score labels", () => {
    render(<HealthScoreBar {...defaultProps} />);
    expect(screen.getByText("Visibility")).toBeInTheDocument();
    expect(screen.getByText("Power")).toBeInTheDocument();
  });

  it("renders score values", () => {
    render(<HealthScoreBar {...defaultProps} />);
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("58")).toBeInTheDocument();
  });

  it("renders positive trend indicator", () => {
    render(<HealthScoreBar {...defaultProps} />);
    expect(screen.getByText("+3")).toBeInTheDocument();
  });

  it("renders negative trend indicator", () => {
    render(<HealthScoreBar {...defaultProps} />);
    expect(screen.getByText("-2")).toBeInTheDocument();
  });

  it("renders summary stats", () => {
    render(<HealthScoreBar {...defaultProps} />);
    expect(screen.getByText("24 keywords ranked")).toBeInTheDocument();
    expect(screen.getByText("Avg position: #12.4")).toBeInTheDocument();
    expect(screen.getByText("3 featured spots")).toBeInTheDocument();
  });

  it("handles null scores gracefully", () => {
    render(
      <HealthScoreBar
        visibilityScore={null}
        visibilityDelta={null}
        powerScore={null}
        powerDelta={null}
        keywordCount={0}
        avgPosition={null}
        featuredCount={0}
      />,
    );
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBe(2);
  });

  it("applies green color for high scores", () => {
    const { container } = render(<HealthScoreBar {...defaultProps} visibilityScore={80} />);
    expect(container.querySelector(".bg-emerald-500")).toBeTruthy();
  });

  it("applies amber color for medium scores", () => {
    const { container } = render(<HealthScoreBar {...defaultProps} visibilityScore={50} powerScore={45} />);
    const amberBars = container.querySelectorAll(".bg-amber-500");
    expect(amberBars.length).toBe(2);
  });

  it("applies red color for low scores", () => {
    const { container } = render(<HealthScoreBar {...defaultProps} visibilityScore={20} />);
    expect(container.querySelector(".bg-red-500")).toBeTruthy();
  });
});
