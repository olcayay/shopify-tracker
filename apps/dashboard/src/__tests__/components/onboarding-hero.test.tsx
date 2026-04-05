import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/overview",
  useRouter: () => ({ push: vi.fn() }),
}));

import React from "react";
import { OnboardingHero } from "@/components/onboarding-hero";

describe("OnboardingHero", () => {
  it("renders welcome heading", () => {
    render(<OnboardingHero />);
    expect(screen.getByText("Welcome to AppRanks")).toBeInTheDocument();
  });

  it("shows 3-step onboarding", () => {
    render(<OnboardingHero />);
    expect(screen.getByText("1. Choose Platform")).toBeInTheDocument();
    expect(screen.getByText("2. Add Your App")).toBeInTheDocument();
    expect(screen.getByText("3. Track & Optimize")).toBeInTheDocument();
  });

  it("has get started button", () => {
    render(<OnboardingHero />);
    expect(
      screen.getByText("Get Started — Add Your First App")
    ).toBeInTheDocument();
  });

  it("renders platform icon dots", () => {
    const { container } = render(<OnboardingHero />);
    // Should have 12 platform dots (one per platform)
    const dots = container.querySelectorAll('[title]');
    expect(dots.length).toBe(12);
  });
});
