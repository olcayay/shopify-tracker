import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("lucide-react", () => ({
  BarChart3: () => <svg data-testid="bar-chart-icon" />,
}));

import { DashboardFooter } from "../../components/dashboard-footer";

describe("DashboardFooter", () => {
  it("renders footer element", () => {
    const { container } = render(<DashboardFooter />);
    expect(container.querySelector("footer")).toBeInTheDocument();
  });

  it("contains AppRanks text", () => {
    render(<DashboardFooter />);
    expect(screen.getByText("AppRanks")).toBeInTheDocument();
  });

  it("contains copyright with current year", () => {
    render(<DashboardFooter />);
    const year = new Date().getFullYear();
    expect(screen.getAllByText(`\u00A9 ${year} AppRanks`).length).toBeGreaterThan(0);
  });

  it("has Terms link pointing to /terms", () => {
    render(<DashboardFooter />);
    const termsLinks = screen.getAllByText("Terms");
    expect(termsLinks.length).toBeGreaterThan(0);
    expect(termsLinks[0].closest("a")).toHaveAttribute("href", "/terms");
  });

  it("has Privacy link pointing to /privacy", () => {
    render(<DashboardFooter />);
    const privacyLinks = screen.getAllByText("Privacy");
    expect(privacyLinks.length).toBeGreaterThan(0);
    expect(privacyLinks[0].closest("a")).toHaveAttribute("href", "/privacy");
  });

  it("has Support link to /support", () => {
    render(<DashboardFooter />);
    const supportLinks = screen.getAllByText("Support");
    expect(supportLinks.length).toBeGreaterThan(0);
    expect(supportLinks[0].closest("a")).toHaveAttribute("href", "/support");
  });

  it("renders gradient divider", () => {
    const { container } = render(<DashboardFooter />);
    const divider = container.querySelector("footer > div:first-child") as HTMLElement;
    expect(divider).toBeInTheDocument();
    expect(divider.style.background).toContain("linear-gradient");
  });
});
