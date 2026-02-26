import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CtaSection } from "@/components/landing/cta-section";

describe("CtaSection", () => {
  it("renders the heading", () => {
    render(<CtaSection />);
    expect(
      screen.getByText("Ready to Outrank Your Competition?")
    ).toBeInTheDocument();
  });

  it("renders the subtitle", () => {
    render(<CtaSection />);
    expect(
      screen.getByText(/Stop guessing, start growing/)
    ).toBeInTheDocument();
  });

  it("renders Create Free Account button", () => {
    render(<CtaSection />);
    expect(screen.getByText("Create Free Account")).toBeInTheDocument();
  });

  it("renders Sign In button", () => {
    render(<CtaSection />);
    expect(screen.getByText("Sign In")).toBeInTheDocument();
  });

  it("Create Free Account links to /register", () => {
    render(<CtaSection />);
    const link = screen.getByText("Create Free Account").closest("a");
    expect(link).toHaveAttribute("href", "/register");
  });

  it("Sign In links to /login", () => {
    render(<CtaSection />);
    const link = screen.getByText("Sign In").closest("a");
    expect(link).toHaveAttribute("href", "/login");
  });

  it("renders as a section element", () => {
    const { container } = render(<CtaSection />);
    expect(container.querySelector("section")).toBeTruthy();
  });

  it("has gradient background styling", () => {
    const { container } = render(<CtaSection />);
    const card = container.querySelector(".bg-gradient-to-br");
    expect(card).toBeTruthy();
  });

  it("renders decorative circles", () => {
    const { container } = render(<CtaSection />);
    const circles = container.querySelectorAll(".rounded-full.bg-white\\/10");
    expect(circles.length).toBe(2);
  });
});
