import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketingFooter } from "@/components/landing/marketing-footer";

describe("MarketingFooter", () => {
  it("renders AppRanks brand name", () => {
    render(<MarketingFooter />);
    expect(screen.getByText("AppRanks")).toBeInTheDocument();
  });

  it("renders brand description", () => {
    render(<MarketingFooter />);
    expect(
      screen.getByText(/Shopify App Store intelligence platform/)
    ).toBeInTheDocument();
  });

  it("renders Product section", () => {
    render(<MarketingFooter />);
    expect(screen.getByText("Product")).toBeInTheDocument();
  });

  it("renders Get Started link to /register", () => {
    render(<MarketingFooter />);
    const link = screen.getByText("Get Started").closest("a");
    expect(link).toHaveAttribute("href", "/register");
  });

  it("renders Sign In link to /login", () => {
    render(<MarketingFooter />);
    const link = screen.getByText("Sign In").closest("a");
    expect(link).toHaveAttribute("href", "/login");
  });

  it("renders Company section", () => {
    render(<MarketingFooter />);
    expect(screen.getByText("Company")).toBeInTheDocument();
  });

  it("renders Terms & Conditions link", () => {
    render(<MarketingFooter />);
    const link = screen.getByText("Terms & Conditions").closest("a");
    expect(link).toHaveAttribute("href", "/terms");
  });

  it("renders Privacy Policy link", () => {
    render(<MarketingFooter />);
    const link = screen.getByText("Privacy Policy").closest("a");
    expect(link).toHaveAttribute("href", "/privacy");
  });

  it("renders Contact link", () => {
    render(<MarketingFooter />);
    const link = screen.getByText("Contact").closest("a");
    expect(link).toHaveAttribute("href", "mailto:support@appranks.io");
  });

  it("renders copyright text", () => {
    render(<MarketingFooter />);
    expect(
      screen.getByText(/AppRanks. All rights reserved/)
    ).toBeInTheDocument();
  });

  it("renders as a footer element", () => {
    const { container } = render(<MarketingFooter />);
    expect(container.querySelector("footer")).toBeTruthy();
  });

  it("renders current year in copyright", () => {
    render(<MarketingFooter />);
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
  });
});
