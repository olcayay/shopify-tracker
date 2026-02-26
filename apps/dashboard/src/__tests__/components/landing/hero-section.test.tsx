import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroSection } from "@/components/landing/hero-section";

describe("HeroSection", () => {
  it("renders the main heading", () => {
    render(<HeroSection />);
    expect(screen.getByText(/Stop Guessing/)).toBeInTheDocument();
    expect(screen.getByText(/Start Ranking/)).toBeInTheDocument();
  });

  it("renders the subtitle", () => {
    render(<HeroSection />);
    expect(
      screen.getByText(/all-in-one intelligence platform/)
    ).toBeInTheDocument();
  });

  it("renders Get Started Free CTA button", () => {
    render(<HeroSection />);
    expect(screen.getByText("Get Started Free")).toBeInTheDocument();
  });

  it("renders Sign In button", () => {
    render(<HeroSection />);
    expect(screen.getByText("Sign In")).toBeInTheDocument();
  });

  it("CTA links to /register", () => {
    render(<HeroSection />);
    const link = screen.getByText("Get Started Free").closest("a");
    expect(link).toHaveAttribute("href", "/register");
  });

  it("Sign In links to /login", () => {
    render(<HeroSection />);
    const link = screen.getByText("Sign In").closest("a");
    expect(link).toHaveAttribute("href", "/login");
  });

  it("renders stats section", () => {
    render(<HeroSection />);
    expect(screen.getByText(/24\/7/)).toBeInTheDocument();
    expect(screen.getByText(/Monitoring/)).toBeInTheDocument();
  });

  it("renders the intelligence badge", () => {
    render(<HeroSection />);
    expect(
      screen.getByText(/Trusted by Shopify app developers/)
    ).toBeInTheDocument();
  });
});
