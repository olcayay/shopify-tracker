import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { atlassianSections } from "@/components/platform-sections/atlassian-sections";
import type { PlatformSectionProps } from "@/components/platform-sections";

type Props = PlatformSectionProps<"atlassian">;

const baseProps: Props = {
  platform: "atlassian",
  platformData: {} as any,
  snapshot: {},
  app: {},
};

describe("AtlassianAppInfo", () => {
  const Section = atlassianSections.find((s) => s.id === "atlassian-app-info")!;
  const Component = Section.component;

  it("renders without errors with valid props", () => {
    const props: Props = {
      ...baseProps,
      platformData: { paymentModel: "free" } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("App Info")).toBeInTheDocument();
  });

  it("renders payment model correctly for free apps", () => {
    const props: Props = {
      ...baseProps,
      platformData: { paymentModel: "free" } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("renders payment model correctly for atlassian-paid apps", () => {
    const props: Props = {
      ...baseProps,
      platformData: { paymentModel: "atlassian" } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Paid via Atlassian")).toBeInTheDocument();
  });

  it("renders payment model correctly for vendor-paid apps", () => {
    const props: Props = {
      ...baseProps,
      platformData: { paymentModel: "vendor" } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Paid via Vendor")).toBeInTheDocument();
  });

  it("renders license type", () => {
    const props: Props = {
      ...baseProps,
      platformData: { licenseType: "Commercial" } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Commercial")).toBeInTheDocument();
  });

  it("renders release date formatted", () => {
    const props: Props = {
      ...baseProps,
      platformData: { releaseDate: "2024-01-15T00:00:00Z" } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Jan 15, 2024")).toBeInTheDocument();
  });

  it("renders compatibilities as badges", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        compatibilities: [
          { application: "Jira", cloud: true, server: false, dataCenter: false },
          { application: "Confluence", cloud: false, server: true, dataCenter: false },
        ],
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Jira Cloud")).toBeInTheDocument();
    expect(screen.getByText("Confluence Server")).toBeInTheDocument();
  });

  it("handles empty data gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("App Info")).toBeInTheDocument();
  });

  it("shouldRender returns false when no data", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when paymentModel exists", () => {
    const props: Props = {
      ...baseProps,
      platformData: { paymentModel: "free" } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});

describe("AtlassianTrustSignals", () => {
  const Section = atlassianSections.find((s) => s.id === "atlassian-trust-signals")!;
  const Component = Section.component;

  it("renders Cloud Fortified badge", () => {
    const props: Props = {
      ...baseProps,
      platformData: { cloudFortified: true } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Trust Signals")).toBeInTheDocument();
    expect(screen.getByText("Cloud Fortified")).toBeInTheDocument();
  });

  it("renders Top Vendor badge", () => {
    const props: Props = {
      ...baseProps,
      platformData: { topVendor: true } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Top Vendor")).toBeInTheDocument();
  });

  it("renders Bug Bounty Participant badge", () => {
    const props: Props = {
      ...baseProps,
      platformData: { bugBountyParticipant: true } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Bug Bounty Participant")).toBeInTheDocument();
  });

  it("renders multiple trust signals", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        cloudFortified: true,
        topVendor: true,
        bugBountyParticipant: true,
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Cloud Fortified")).toBeInTheDocument();
    expect(screen.getByText("Top Vendor")).toBeInTheDocument();
    expect(screen.getByText("Bug Bounty Participant")).toBeInTheDocument();
  });

  it("handles no trust signals gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("Trust Signals")).toBeInTheDocument();
    expect(screen.queryByText("Cloud Fortified")).not.toBeInTheDocument();
  });

  it("shouldRender returns false when no signals", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });
});

describe("AtlassianLinks", () => {
  const Section = atlassianSections.find((s) => s.id === "atlassian-links")!;
  const Component = Section.component;

  it("renders all link types", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        vendorHomePage: "https://vendor.com",
        documentationUrl: "https://docs.vendor.com",
        eulaUrl: "https://eula.vendor.com",
        slaUrl: "https://sla.vendor.com",
        trustCenterUrl: "https://trust.vendor.com",
        contactEmail: "contact@vendor.com",
        vendorLinks: {
          privacy: "https://privacy.vendor.com",
          appStatusPage: "https://status.vendor.com",
        },
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Links")).toBeInTheDocument();
    expect(screen.getByText("https://vendor.com")).toBeInTheDocument();
    expect(screen.getByText("https://docs.vendor.com")).toBeInTheDocument();
    expect(screen.getByText("contact@vendor.com")).toBeInTheDocument();
  });

  it("renders contact email as mailto link", () => {
    const props: Props = {
      ...baseProps,
      platformData: { contactEmail: "contact@vendor.com" } as any,
    };
    const { container } = render(<Component {...props} />);
    const link = container.querySelector('a[href="mailto:contact@vendor.com"]');
    expect(link).toBeTruthy();
  });

  it("handles missing links gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("Links")).toBeInTheDocument();
  });

  it("shouldRender returns false when no links", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when documentationUrl exists", () => {
    const props: Props = {
      ...baseProps,
      platformData: { documentationUrl: "https://docs.example.com" } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});
