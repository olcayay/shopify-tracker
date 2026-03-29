import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { zendeskSections } from "@/components/platform-sections/zendesk-sections";
import type { PlatformSectionProps } from "@/components/platform-sections";

type Props = PlatformSectionProps<"zendesk">;

const baseProps: Props = {
  platform: "zendesk",
  platformData: {} as any,
  snapshot: {},
  app: {},
};

describe("ZendeskProducts", () => {
  const Section = zendeskSections.find((s) => s.id === "zendesk-products")!;
  const Component = Section.component;

  it("renders without errors with valid props", () => {
    const props: Props = {
      ...baseProps,
      platformData: { products: ["Support", "Chat"] } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Products")).toBeInTheDocument();
  });

  it("renders string products as badges", () => {
    const props: Props = {
      ...baseProps,
      platformData: { products: ["Support", "Chat", "Sell"] } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Support")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Sell")).toBeInTheDocument();
  });

  it("renders object products using label or name field", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        products: [{ label: "Support Suite" }, { name: "Chat Pro" }],
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Support Suite")).toBeInTheDocument();
    expect(screen.getByText("Chat Pro")).toBeInTheDocument();
  });

  it("handles empty products gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("Products")).toBeInTheDocument();
  });

  it("shouldRender returns false when no products", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when products exist", () => {
    const props: Props = {
      ...baseProps,
      platformData: { products: ["Support"] } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});

describe("ZendeskAppInfo", () => {
  const Section = zendeskSections.find((s) => s.id === "zendesk-app-info")!;
  const Component = Section.component;

  it("renders without errors with valid props", () => {
    const props: Props = {
      ...baseProps,
      platformData: { version: "3.2.1" } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("App Info")).toBeInTheDocument();
  });

  it("renders all app info fields", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        version: "3.2.1",
        pricing: "Free",
        datePublished: "2024-06-15T00:00:00Z",
        source: "Zendesk",
        installationInstructions: "Install via marketplace",
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("3.2.1")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Jun 15, 2024")).toBeInTheDocument();
    expect(screen.getByText("Zendesk")).toBeInTheDocument();
    expect(screen.getByText("Install via marketplace")).toBeInTheDocument();
  });

  it("renders field labels", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        version: "1.0",
        pricing: "$5/mo",
        source: "Partner",
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Version")).toBeInTheDocument();
    expect(screen.getByText("Pricing")).toBeInTheDocument();
    expect(screen.getByText("Source")).toBeInTheDocument();
  });

  it("formats date published correctly", () => {
    const props: Props = {
      ...baseProps,
      platformData: { datePublished: "2023-12-25T00:00:00Z" } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Dec 25, 2023")).toBeInTheDocument();
  });

  it("handles empty data gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("App Info")).toBeInTheDocument();
    expect(screen.queryByText("Version")).not.toBeInTheDocument();
  });

  it("shouldRender returns false when no data", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when version exists", () => {
    const props: Props = {
      ...baseProps,
      platformData: { version: "1.0" } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});
