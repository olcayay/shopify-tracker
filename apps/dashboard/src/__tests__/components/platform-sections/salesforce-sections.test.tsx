import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { salesforceSections } from "@/components/platform-sections/salesforce-sections";
import type { PlatformSectionProps } from "@/components/platform-sections";

type Props = PlatformSectionProps<"salesforce">;

const baseProps: Props = {
  platform: "salesforce",
  platformData: {} as any,
  snapshot: {},
  app: {},
};

describe("SalesforceBadgeGrid", () => {
  const Section = salesforceSections.find((s) => s.id === "salesforce-badge-grid")!;
  const Component = Section.component;

  it("renders without errors with valid props", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        supportedIndustries: ["Healthcare"],
        businessNeeds: ["Analytics"],
        productsRequired: ["Sales Cloud"],
      } as any,
      snapshot: { languages: ["English"], integrations: ["Slack"] },
    };
    render(<Component {...props} />);
    expect(screen.getByText("Salesforce Details")).toBeInTheDocument();
  });

  it("renders industries as linked badges", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        supportedIndustries: ["Healthcare", "Financial Services"],
      } as any,
      snapshot: {},
    };
    const { container } = render(<Component {...props} />);
    expect(screen.getByText("Industries")).toBeInTheDocument();
    expect(screen.getByText("Healthcare")).toBeInTheDocument();
    expect(screen.getByText("Financial Services")).toBeInTheDocument();
    const link = container.querySelector('a[href="/salesforce/discover/industry/healthcare"]');
    expect(link).toBeTruthy();
  });

  it("renders business needs section", () => {
    const props: Props = {
      ...baseProps,
      platformData: { businessNeeds: ["Analytics", "Reporting"] } as any,
      snapshot: {},
    };
    render(<Component {...props} />);
    expect(screen.getByText("Business Needs")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Reporting")).toBeInTheDocument();
  });

  it("renders products required section", () => {
    const props: Props = {
      ...baseProps,
      platformData: { productsRequired: ["Sales Cloud"] } as any,
      snapshot: {},
    };
    render(<Component {...props} />);
    expect(screen.getByText("Requires")).toBeInTheDocument();
    expect(screen.getByText("Sales Cloud")).toBeInTheDocument();
  });

  it("renders languages from snapshot", () => {
    const props: Props = {
      ...baseProps,
      platformData: {} as any,
      snapshot: { languages: ["English", "Spanish"] },
    };
    render(<Component {...props} />);
    expect(screen.getByText("Languages")).toBeInTheDocument();
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Spanish")).toBeInTheDocument();
  });

  it("renders integrations as linked badges", () => {
    const props: Props = {
      ...baseProps,
      platformData: {} as any,
      snapshot: { integrations: ["Slack"] },
    };
    const { container } = render(<Component {...props} />);
    expect(screen.getByText("Compatible With")).toBeInTheDocument();
    const link = container.querySelector('a[href="/salesforce/integrations/slack"]');
    expect(link).toBeTruthy();
  });

  it("handles empty/missing data gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("Salesforce Details")).toBeInTheDocument();
    expect(screen.queryByText("Industries")).not.toBeInTheDocument();
    expect(screen.queryByText("Business Needs")).not.toBeInTheDocument();
  });

  it("handles non-array businessNeeds gracefully", () => {
    const props: Props = {
      ...baseProps,
      platformData: { businessNeeds: "not-an-array" } as any,
      snapshot: {},
    };
    render(<Component {...props} />);
    expect(screen.queryByText("Business Needs")).not.toBeInTheDocument();
  });

  it("shouldRender returns false when all data is empty", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when industries exist", () => {
    const props: Props = {
      ...baseProps,
      platformData: { supportedIndustries: ["Healthcare"] } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});
