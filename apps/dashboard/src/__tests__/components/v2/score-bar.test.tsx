import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreBar } from "@/components/v2/score-bar";

describe("ScoreBar", () => {
  it("renders label and score", () => {
    render(<ScoreBar label="Visibility" score={72} />);
    expect(screen.getByText("Visibility:")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
  });

  it("renders dash for null score", () => {
    render(<ScoreBar label="Power" score={null} />);
    expect(screen.getByText("Power:")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders green bar for high score", () => {
    const { container } = render(<ScoreBar label="Test" score={80} />);
    const bar = container.querySelector(".bg-emerald-500");
    expect(bar).toBeTruthy();
  });

  it("renders amber bar for medium score", () => {
    const { container } = render(<ScoreBar label="Test" score={55} />);
    const bar = container.querySelector(".bg-amber-500");
    expect(bar).toBeTruthy();
  });

  it("renders orange bar for low-medium score", () => {
    const { container } = render(<ScoreBar label="Test" score={30} />);
    const bar = container.querySelector(".bg-orange-500");
    expect(bar).toBeTruthy();
  });

  it("renders red bar for low score", () => {
    const { container } = render(<ScoreBar label="Test" score={15} />);
    const bar = container.querySelector(".bg-red-500");
    expect(bar).toBeTruthy();
  });

  it("clamps bar width to 100%", () => {
    const { container } = render(<ScoreBar label="Test" score={150} maxScore={100} />);
    const bar = container.querySelector("[style]");
    expect(bar?.getAttribute("style")).toContain("width: 100%");
  });

  it("respects custom maxScore", () => {
    const { container } = render(<ScoreBar label="Test" score={50} maxScore={200} />);
    const bar = container.querySelector("[style]");
    expect(bar?.getAttribute("style")).toContain("width: 25%");
  });
});
