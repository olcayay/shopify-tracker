import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeaturesSection } from "@/components/landing/features-section";

describe("FeaturesSection", () => {
  it("renders the section heading", () => {
    render(<FeaturesSection />);
    expect(screen.getByText("Your Unfair Advantage")).toBeInTheDocument();
  });

  it("renders the subtitle", () => {
    render(<FeaturesSection />);
    expect(
      screen.getByText(/9 powerful tools in one dashboard/)
    ).toBeInTheDocument();
  });

  it("renders all 9 feature cards", () => {
    render(<FeaturesSection />);
    expect(screen.getByText("App Tracking")).toBeInTheDocument();
    expect(screen.getByText("Keyword Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Category Rankings")).toBeInTheDocument();
    expect(screen.getByText("Competitor Intel")).toBeInTheDocument();
    expect(screen.getByText("Review Analytics")).toBeInTheDocument();
    expect(screen.getByText("Ad Tracking")).toBeInTheDocument();
    expect(screen.getByText("App Comparison")).toBeInTheDocument();
    expect(screen.getByText("Market Discovery")).toBeInTheDocument();
    expect(screen.getByText("Team Collaboration")).toBeInTheDocument();
  });

  it("renders feature descriptions", () => {
    render(<FeaturesSection />);
    expect(
      screen.getByText(/Track any app's details, pricing/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Track search positions over time/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Full category tree with position history/)
    ).toBeInTheDocument();
  });

  it("renders 9 feature cards in the grid", () => {
    const { container } = render(<FeaturesSection />);
    const grid = container.querySelector(".grid");
    expect(grid).toBeTruthy();
    expect(grid?.children.length).toBe(9);
  });

  it("renders as a section element", () => {
    const { container } = render(<FeaturesSection />);
    expect(container.querySelector("section")).toBeTruthy();
  });
});
