import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProblemSection } from "@/components/landing/problem-section";

describe("ProblemSection", () => {
  it("renders the section heading", () => {
    render(<ProblemSection />);
    expect(screen.getByText("Sound Familiar?")).toBeInTheDocument();
  });

  it("renders the subtitle", () => {
    render(<ProblemSection />);
    expect(
      screen.getByText(/The Shopify App Store gives you zero analytics/)
    ).toBeInTheDocument();
  });

  it("renders all 6 problem cards", () => {
    render(<ProblemSection />);
    expect(screen.getByText("No Ranking History")).toBeInTheDocument();
    expect(screen.getByText("Manual Competitor Monitoring")).toBeInTheDocument();
    expect(screen.getByText("Keyword Guesswork")).toBeInTheDocument();
    expect(screen.getByText("Invisible Featured Placements")).toBeInTheDocument();
    expect(screen.getByText("Spreadsheet Hell")).toBeInTheDocument();
    expect(screen.getByText("Hours of Market Research")).toBeInTheDocument();
  });

  it("renders emojis for each problem", () => {
    render(<ProblemSection />);
    expect(screen.getByText("📉")).toBeInTheDocument();
    expect(screen.getByText("🕵️")).toBeInTheDocument();
    expect(screen.getByText("🎯")).toBeInTheDocument();
    expect(screen.getByText("👻")).toBeInTheDocument();
    expect(screen.getByText("📊")).toBeInTheDocument();
    expect(screen.getByText("⏰")).toBeInTheDocument();
  });

  it("renders problem descriptions", () => {
    render(<ProblemSection />);
    expect(
      screen.getByText(/Where were you ranked last week/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Checking competitor listings/)
    ).toBeInTheDocument();
  });

  it("renders as a section element", () => {
    const { container } = render(<ProblemSection />);
    const section = container.querySelector("section");
    expect(section).toBeTruthy();
  });

  it("renders problem cards in a grid", () => {
    const { container } = render(<ProblemSection />);
    const grid = container.querySelector(".grid");
    expect(grid).toBeTruthy();
    expect(grid?.children.length).toBe(6);
  });
});
