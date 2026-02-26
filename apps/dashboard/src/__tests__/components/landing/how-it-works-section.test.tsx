import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";

describe("HowItWorksSection", () => {
  it("renders the section heading", () => {
    render(<HowItWorksSection />);
    expect(
      screen.getByText("Up and Running in 5 Minutes")
    ).toBeInTheDocument();
  });

  it("renders the subtitle", () => {
    render(<HowItWorksSection />);
    expect(
      screen.getByText(/No complex setup. No learning curve/)
    ).toBeInTheDocument();
  });

  it("renders all 6 steps", () => {
    render(<HowItWorksSection />);
    // Each step title appears in both mobile and desktop layouts
    expect(screen.getAllByText("Add Your Apps").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Set Up Keywords").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Add Competitors").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Star Categories").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Watch Your Dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Get Daily Digests").length).toBeGreaterThanOrEqual(1);
  });

  it("renders step descriptions", () => {
    render(<HowItWorksSection />);
    expect(
      screen.getByText("Search and start tracking with one click.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("We track your search positions automatically.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Everything updated continuously, 24/7.")
    ).toBeInTheDocument();
  });

  it("renders step numbers", () => {
    render(<HowItWorksSection />);
    // Each step has its number shown (both mobile and desktop)
    const ones = screen.getAllByText("1");
    expect(ones.length).toBeGreaterThanOrEqual(1);
    const sixes = screen.getAllByText("6");
    expect(sixes.length).toBeGreaterThanOrEqual(1);
  });

  it("renders as a section element with muted background", () => {
    const { container } = render(<HowItWorksSection />);
    const section = container.querySelector("section");
    expect(section).toBeTruthy();
    expect(section?.className).toContain("bg-muted");
  });
});
