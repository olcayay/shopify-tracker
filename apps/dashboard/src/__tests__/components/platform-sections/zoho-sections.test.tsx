import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { zohoSections } from "@/components/platform-sections/zoho-sections";
import type { PlatformSectionProps } from "@/components/platform-sections";

type Props = PlatformSectionProps<"zoho">;

const baseProps: Props = {
  platform: "zoho",
  platformData: {} as any,
  snapshot: {},
  app: {},
};

describe("ZohoAppInfo", () => {
  const Section = zohoSections.find((s) => s.id === "zoho-app-info")!;
  const Component = Section.component;

  it("renders without errors with valid props", () => {
    const props: Props = {
      ...baseProps,
      platformData: { namespace: "crm" } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("App Info")).toBeInTheDocument();
  });

  it("renders all app info fields", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        namespace: "crm",
        deploymentType: "Cloud",
        cEdition: "Enterprise",
        pricing: "Free",
        version: "2.1.0",
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("crm")).toBeInTheDocument();
    expect(screen.getByText("Cloud")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("2.1.0")).toBeInTheDocument();
  });

  it("renders field labels correctly", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        namespace: "crm",
        deploymentType: "Cloud",
        version: "1.0",
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Namespace")).toBeInTheDocument();
    expect(screen.getByText("Deployment Type")).toBeInTheDocument();
    expect(screen.getByText("Version")).toBeInTheDocument();
  });

  it("handles empty data gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("App Info")).toBeInTheDocument();
    expect(screen.queryByText("Namespace")).not.toBeInTheDocument();
  });

  it("shouldRender returns false when no data", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when namespace exists", () => {
    const props: Props = {
      ...baseProps,
      platformData: { namespace: "crm" } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});

describe("ZohoPartnerDetails", () => {
  const Section = zohoSections.find((s) => s.id === "zoho-partner-details")!;
  const Component = Section.component;

  it("renders partner company name, email, and website", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        partnerDetails: [
          {
            companyName: "Acme Corp",
            supportEmail: "support@acme.com",
            websiteUrl: "https://acme.com",
            partner_uuid: "abc-123",
          },
        ],
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Partner Details")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("support@acme.com")).toBeInTheDocument();
    expect(screen.getByText("https://acme.com")).toBeInTheDocument();
  });

  it("renders mailto link for support email", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        partnerDetails: [{ supportEmail: "support@acme.com" }],
      } as any,
    };
    const { container } = render(<Component {...props} />);
    const link = container.querySelector('a[href="mailto:support@acme.com"]');
    expect(link).toBeTruthy();
  });

  it("renders multiple partners", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        partnerDetails: [
          { companyName: "Acme Corp", partner_uuid: "1" },
          { companyName: "Beta Inc", partner_uuid: "2" },
        ],
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();
  });

  it("handles empty partners gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("Partner Details")).toBeInTheDocument();
  });

  it("shouldRender returns false when no partners", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });
});

describe("ZohoRatingBreakdown", () => {
  const Section = zohoSections.find((s) => s.id === "zoho-rating-breakdown")!;
  const Component = Section.component;

  it("renders rating breakdown bars", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        ratingBreakdown: {
          fivestar: 80,
          fourstar: 30,
          threestar: 10,
          twostar: 5,
          onestar: 2,
        },
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Rating Breakdown")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("renders all five star rows", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        ratingBreakdown: {
          fivestar: 100,
          fourstar: 50,
          threestar: 30,
          twostar: 20,
          onestar: 10,
        },
      } as any,
    };
    const { container } = render(<Component {...props} />);
    // Each star row has a label span and a count span
    const rows = container.querySelectorAll(".flex.items-center.gap-2");
    expect(rows.length).toBe(5);
    // Verify counts are rendered
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("returns null when no breakdown data", () => {
    const { container } = render(<Component {...baseProps} />);
    expect(container.querySelector(".space-y-2")).toBeNull();
  });

  it("shouldRender returns false when no breakdown", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when breakdown exists", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        ratingBreakdown: { fivestar: 1, fourstar: 0, threestar: 0, twostar: 0, onestar: 0 },
      } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});
