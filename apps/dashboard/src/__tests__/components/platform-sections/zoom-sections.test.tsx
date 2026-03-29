import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { zoomSections } from "@/components/platform-sections/zoom-sections";
import type { PlatformSectionProps } from "@/components/platform-sections";

type Props = PlatformSectionProps<"zoom">;

const baseProps: Props = {
  platform: "zoom",
  platformData: {} as any,
  snapshot: {},
  app: {},
};

describe("ZoomAppInfo", () => {
  const Section = zoomSections.find((s) => s.id === "zoom-app-info")!;
  const Component = Section.component;

  it("renders without errors with valid props", () => {
    const props: Props = {
      ...baseProps,
      platformData: { companyName: "Zoom Video" } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("App Info")).toBeInTheDocument();
  });

  it("renders company name", () => {
    const props: Props = {
      ...baseProps,
      platformData: { companyName: "Zoom Video Communications" } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Company")).toBeInTheDocument();
    expect(screen.getByText("Zoom Video Communications")).toBeInTheDocument();
  });

  it("renders usage info", () => {
    const props: Props = {
      ...baseProps,
      platformData: { usage: "Collaboration" } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Usage")).toBeInTheDocument();
    expect(screen.getByText("Collaboration")).toBeInTheDocument();
  });

  it("renders worksWith as badges", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        worksWith: ["Zoom Meetings", "Zoom Webinars"],
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Works With")).toBeInTheDocument();
    expect(screen.getByText("Zoom Meetings")).toBeInTheDocument();
    expect(screen.getByText("Zoom Webinars")).toBeInTheDocument();
  });

  it("handles empty data gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("App Info")).toBeInTheDocument();
    expect(screen.queryByText("Company")).not.toBeInTheDocument();
  });

  it("shouldRender returns false when no data", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when companyName exists", () => {
    const props: Props = {
      ...baseProps,
      platformData: { companyName: "Zoom" } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});

describe("ZoomTrustSignals", () => {
  const Section = zoomSections.find((s) => s.id === "zoom-trust-signals")!;
  const Component = Section.component;

  it("renders FedRAMP Authorized badge", () => {
    const props: Props = {
      ...baseProps,
      platformData: { fedRampAuthorized: true } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Trust Signals")).toBeInTheDocument();
    expect(screen.getByText("FedRAMP Authorized")).toBeInTheDocument();
  });

  it("renders Essential App badge", () => {
    const props: Props = {
      ...baseProps,
      platformData: { essentialApp: true } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Essential App")).toBeInTheDocument();
  });

  it("renders both trust signals together", () => {
    const props: Props = {
      ...baseProps,
      platformData: { fedRampAuthorized: true, essentialApp: true } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("FedRAMP Authorized")).toBeInTheDocument();
    expect(screen.getByText("Essential App")).toBeInTheDocument();
  });

  it("handles no trust signals gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("Trust Signals")).toBeInTheDocument();
    expect(screen.queryByText("FedRAMP Authorized")).not.toBeInTheDocument();
  });

  it("shouldRender returns false when no signals", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when fedRampAuthorized is true", () => {
    const props: Props = {
      ...baseProps,
      platformData: { fedRampAuthorized: true } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});
