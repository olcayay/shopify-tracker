import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DifferentiatorsSection } from "@/components/landing/differentiators-section";

describe("DifferentiatorsSection", () => {
  it("renders the section heading", () => {
    render(<DifferentiatorsSection />);
    expect(
      screen.getByText("Why Teams Choose AppRanks")
    ).toBeInTheDocument();
  });

  it("renders the subtitle", () => {
    render(<DifferentiatorsSection />);
    expect(
      screen.getByText(/Built for developers who are serious/)
    ).toBeInTheDocument();
  });

  it("renders all 7 differentiators", () => {
    render(<DifferentiatorsSection />);
    expect(screen.getByText("Complete Historical Data")).toBeInTheDocument();
    expect(screen.getByText("24/7 Automated Monitoring")).toBeInTheDocument();
    expect(screen.getByText("Review Momentum Analysis")).toBeInTheDocument();
    expect(
      screen.getByText("Multi-Dimensional Similarity")
    ).toBeInTheDocument();
    expect(screen.getByText("Ad Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Change Detection")).toBeInTheDocument();
    expect(screen.getByText("All-in-One Platform")).toBeInTheDocument();
  });

  it("renders differentiator descriptions", () => {
    render(<DifferentiatorsSection />);
    expect(
      screen.getByText(/Every data point stored as a snapshot/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Not just counts — know if reviews/)
    ).toBeInTheDocument();
  });

  it("renders 7 items in the grid", () => {
    const { container } = render(<DifferentiatorsSection />);
    const grid = container.querySelector(".grid");
    expect(grid).toBeTruthy();
    expect(grid?.children.length).toBe(7);
  });

  it("renders as a section element", () => {
    const { container } = render(<DifferentiatorsSection />);
    expect(container.querySelector("section")).toBeTruthy();
  });
});
