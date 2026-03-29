import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { hubspotSections } from "@/components/platform-sections/hubspot-sections";
import type { PlatformSectionProps } from "@/components/platform-sections";

type Props = PlatformSectionProps<"hubspot">;

const baseProps: Props = {
  platform: "hubspot",
  platformData: {} as any,
  snapshot: {},
  app: {},
};

describe("HubSpotAppInfo", () => {
  const Section = hubspotSections.find((s) => s.id === "hubspot-app-info")!;
  const Component = Section.component;

  it("renders without errors with valid props", () => {
    const props: Props = {
      ...baseProps,
      platformData: { productType: "Integration" } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("App Info")).toBeInTheDocument();
  });

  it("renders product type and connection type", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        productType: "Integration",
        connectionType: "OAuth",
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Integration")).toBeInTheDocument();
    expect(screen.getByText("OAuth")).toBeInTheDocument();
  });

  it("renders offering ID", () => {
    const props: Props = {
      ...baseProps,
      platformData: { offeringId: 12345 } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Offering ID")).toBeInTheDocument();
    expect(screen.getByText("12345")).toBeInTheDocument();
  });

  it("renders Certified badge", () => {
    const props: Props = {
      ...baseProps,
      platformData: { certified: true } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Certified")).toBeInTheDocument();
  });

  it("renders Built by HubSpot badge", () => {
    const props: Props = {
      ...baseProps,
      platformData: { builtByHubSpot: true } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Built by HubSpot")).toBeInTheDocument();
  });

  it("renders both badges together", () => {
    const props: Props = {
      ...baseProps,
      platformData: { certified: true, builtByHubSpot: true } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Certified")).toBeInTheDocument();
    expect(screen.getByText("Built by HubSpot")).toBeInTheDocument();
  });

  it("handles empty data gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("App Info")).toBeInTheDocument();
    expect(screen.queryByText("Certified")).not.toBeInTheDocument();
  });

  it("shouldRender returns false when no data", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when certified", () => {
    const props: Props = {
      ...baseProps,
      platformData: { certified: true } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});

describe("HubSpotPricingPlans", () => {
  const Section = hubspotSections.find((s) => s.id === "hubspot-pricing-plans")!;
  const Component = Section.component;

  it("renders without errors with valid props", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        pricingPlans: [{ name: "Free", monthlyPrice: 0 }],
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Pricing Plans")).toBeInTheDocument();
  });

  it("renders free plan correctly", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        pricingPlans: [{ name: "Starter", monthlyPrice: 0 }],
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("renders paid plan with price", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        pricingPlans: [{ name: "Pro", monthlyPrice: 49 }],
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("49/mo")).toBeInTheDocument();
  });

  it("renders plan model badges", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        pricingPlans: [
          { name: "Enterprise", monthlyPrice: 99, model: ["Per User", "Annual"] },
        ],
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Per User")).toBeInTheDocument();
    expect(screen.getByText("Annual")).toBeInTheDocument();
  });

  it("renders plan features", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        pricingPlans: [
          {
            name: "Pro",
            monthlyPrice: 29,
            features: ["Unlimited contacts", "Advanced analytics"],
          },
        ],
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("- Unlimited contacts")).toBeInTheDocument();
    expect(screen.getByText("- Advanced analytics")).toBeInTheDocument();
  });

  it("renders multiple pricing plans", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        pricingPlans: [
          { name: "Starter", monthlyPrice: 0 },
          { name: "Pro", monthlyPrice: 49 },
          { name: "Enterprise", monthlyPrice: 199 },
        ],
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
  });

  it("handles empty plans gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("Pricing Plans")).toBeInTheDocument();
  });

  it("shouldRender returns false when no plans", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when plans exist", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        pricingPlans: [{ name: "Free", monthlyPrice: 0 }],
      } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});
