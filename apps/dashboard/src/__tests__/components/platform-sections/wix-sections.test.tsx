import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { wixSections } from "@/components/platform-sections/wix-sections";
import type { PlatformSectionProps } from "@/components/platform-sections";

type Props = PlatformSectionProps<"wix">;

const baseProps: Props = {
  platform: "wix",
  platformData: {} as any,
  snapshot: {},
  app: {},
};

describe("WixCollections", () => {
  const Section = wixSections.find((s) => s.id === "wix-collections")!;
  const Component = Section.component;

  it("renders without errors with valid props", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        collections: [{ slug: "marketing", name: "Marketing" }],
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Collections")).toBeInTheDocument();
  });

  it("renders collection names as badges", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        collections: [
          { slug: "marketing", name: "Marketing" },
          { slug: "ecommerce", name: "eCommerce" },
        ],
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Marketing")).toBeInTheDocument();
    expect(screen.getByText("eCommerce")).toBeInTheDocument();
  });

  it("handles empty collections gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("Collections")).toBeInTheDocument();
  });

  it("shouldRender returns false when no collections", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });
});

describe("WixPricingDetails", () => {
  const Section = wixSections.find((s) => s.id === "wix-pricing-details")!;
  const Component = Section.component;

  it("renders pricing details correctly", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        currency: "USD",
        trialDays: 14,
        isFreeApp: false,
        isAvailableWorldwide: true,
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Pricing Details")).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("renders free app as Yes", () => {
    const props: Props = {
      ...baseProps,
      platformData: { isFreeApp: true } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("handles zero trial days", () => {
    const props: Props = {
      ...baseProps,
      platformData: { trialDays: 0 } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("handles missing pricing data gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("Pricing Details")).toBeInTheDocument();
    expect(screen.queryByText("Currency")).not.toBeInTheDocument();
  });

  it("shouldRender returns false when no pricing data", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when currency exists", () => {
    const props: Props = {
      ...baseProps,
      platformData: { currency: "USD" } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});

describe("WixRatingHistogram", () => {
  const Section = wixSections.find((s) => s.id === "wix-rating-histogram")!;
  const Component = Section.component;

  it("renders rating histogram bars", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        ratingHistogram: {
          rating5: 100,
          rating4: 50,
          rating3: 20,
          rating2: 10,
          rating1: 5,
        },
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Rating Histogram")).toBeInTheDocument();
    expect(screen.getByText(/100/)).toBeInTheDocument();
    expect(screen.getByText(/50/)).toBeInTheDocument();
  });

  it("calculates percentages correctly", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        ratingHistogram: {
          rating5: 75,
          rating4: 25,
          rating3: 0,
          rating2: 0,
          rating1: 0,
        },
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText(/75 \(75%\)/)).toBeInTheDocument();
    expect(screen.getByText(/25 \(25%\)/)).toBeInTheDocument();
  });

  it("returns null when no histogram data", () => {
    const { container } = render(<Component {...baseProps} />);
    expect(container.querySelector(".space-y-2")).toBeNull();
  });

  it("shouldRender returns false when no histogram", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });
});

describe("WixDeveloperInfo", () => {
  const Section = wixSections.find((s) => s.id === "wix-developer-info")!;
  const Component = Section.component;

  it("renders developer email, privacy URL, and demo URL", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        developerEmail: "dev@wix.com",
        developerPrivacyUrl: "https://wix.com/privacy",
        demoUrl: "https://demo.wix.com",
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Developer Info")).toBeInTheDocument();
    expect(screen.getByText("dev@wix.com")).toBeInTheDocument();
    expect(screen.getByText("https://wix.com/privacy")).toBeInTheDocument();
    expect(screen.getByText("https://demo.wix.com")).toBeInTheDocument();
  });

  it("handles missing developer info gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("Developer Info")).toBeInTheDocument();
  });

  it("shouldRender returns false when no developer info", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when email exists", () => {
    const props: Props = {
      ...baseProps,
      platformData: { developerEmail: "dev@wix.com" } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});
