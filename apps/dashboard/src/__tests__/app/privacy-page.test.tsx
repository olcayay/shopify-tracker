import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacyPage from "@/app/(marketing)/privacy/page";

describe("PrivacyPage", () => {
  it("renders Privacy Policy heading", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
  });

  it("renders effective date", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/February 27, 2026/)).toBeInTheDocument();
  });

  it("renders Introduction section", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("1. Introduction")).toBeInTheDocument();
  });

  it("renders Information We Collect section", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("2. Information We Collect")).toBeInTheDocument();
  });

  it("renders How We Use Your Information section", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("3. How We Use Your Information")).toBeInTheDocument();
  });

  it("renders Data Storage & Security section", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("4. Data Storage & Security")).toBeInTheDocument();
  });

  it("renders Cookies & Tracking Technologies section", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("5. Cookies & Tracking Technologies")).toBeInTheDocument();
  });

  it("renders Third-Party Services section", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("6. Third-Party Services")).toBeInTheDocument();
  });

  it("renders Data Sharing section", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("7. Data Sharing")).toBeInTheDocument();
  });

  it("renders Data Retention section", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("8. Data Retention")).toBeInTheDocument();
  });

  it("renders Your Rights section", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("9. Your Rights")).toBeInTheDocument();
  });

  it("renders Children's Privacy section", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("10. Children's Privacy")).toBeInTheDocument();
  });

  it("renders Changes to This Policy section", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("11. Changes to This Policy")).toBeInTheDocument();
  });

  it("renders Contact section", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("12. Contact")).toBeInTheDocument();
  });

  it("renders contact email links", () => {
    render(<PrivacyPage />);
    const emailLinks = screen.getAllByText("support@appranks.io");
    expect(emailLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("mentions Google Analytics", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/Google Analytics/)).toBeInTheDocument();
  });

  it("mentions Microsoft Clarity", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/Microsoft Clarity/)).toBeInTheDocument();
  });

  it("mentions essential cookies", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("Essential cookies:")).toBeInTheDocument();
  });

  it("mentions user rights", () => {
    render(<PrivacyPage />);
    expect(
      screen.getByText(/Access and receive a copy of your personal data/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Request deletion of your personal data/)
    ).toBeInTheDocument();
  });

  it("has all 12 sections", () => {
    const { container } = render(<PrivacyPage />);
    const sections = container.querySelectorAll("section");
    expect(sections.length).toBe(12);
  });

  it("mentions data retention period", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/within 30 days/)).toBeInTheDocument();
  });

  it("mentions age restriction", () => {
    render(<PrivacyPage />);
    expect(
      screen.getByText(/not intended for individuals under the age of 16/)
    ).toBeInTheDocument();
  });
});
