import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TermsPage from "@/app/(marketing)/terms/page";

describe("TermsPage", () => {
  it("renders Terms & Conditions heading", () => {
    render(<TermsPage />);
    expect(screen.getByText("Terms & Conditions")).toBeInTheDocument();
  });

  it("renders effective date", () => {
    render(<TermsPage />);
    expect(screen.getByText(/February 27, 2026/)).toBeInTheDocument();
  });

  it("renders Acceptance of Terms section", () => {
    render(<TermsPage />);
    expect(screen.getByText("1. Acceptance of Terms")).toBeInTheDocument();
  });

  it("renders Description of Service section", () => {
    render(<TermsPage />);
    expect(screen.getByText("2. Description of Service")).toBeInTheDocument();
  });

  it("renders User Accounts section", () => {
    render(<TermsPage />);
    expect(screen.getByText("3. User Accounts")).toBeInTheDocument();
  });

  it("renders Acceptable Use section", () => {
    render(<TermsPage />);
    expect(screen.getByText("4. Acceptable Use")).toBeInTheDocument();
  });

  it("renders Intellectual Property section", () => {
    render(<TermsPage />);
    expect(screen.getByText("5. Intellectual Property")).toBeInTheDocument();
  });

  it("renders Data and Content section", () => {
    render(<TermsPage />);
    expect(screen.getByText("6. Data and Content")).toBeInTheDocument();
  });

  it("renders Disclaimers section", () => {
    render(<TermsPage />);
    expect(screen.getByText("7. Disclaimers")).toBeInTheDocument();
  });

  it("renders Limitation of Liability section", () => {
    render(<TermsPage />);
    expect(screen.getByText("8. Limitation of Liability")).toBeInTheDocument();
  });

  it("renders Termination section", () => {
    render(<TermsPage />);
    expect(screen.getByText("9. Termination")).toBeInTheDocument();
  });

  it("renders Changes to Terms section", () => {
    render(<TermsPage />);
    expect(screen.getByText("10. Changes to Terms")).toBeInTheDocument();
  });

  it("renders Contact section", () => {
    render(<TermsPage />);
    expect(screen.getByText("11. Contact")).toBeInTheDocument();
  });

  it("renders contact email link", () => {
    render(<TermsPage />);
    const emailLinks = screen.getAllByText("support@appranks.io");
    expect(emailLinks.length).toBeGreaterThanOrEqual(1);
    const link = emailLinks[0].closest("a");
    expect(link).toHaveAttribute("href", "mailto:support@appranks.io");
  });

  it("mentions AppRanks in content", () => {
    render(<TermsPage />);
    expect(
      screen.getByText(/AppRanks is a Shopify App Store intelligence/)
    ).toBeInTheDocument();
  });

  it("has all 11 sections", () => {
    const { container } = render(<TermsPage />);
    const sections = container.querySelectorAll("section");
    expect(sections.length).toBe(11);
  });
});
