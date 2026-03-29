import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { wordpressSections } from "@/components/platform-sections/wordpress-sections";
import type { PlatformSectionProps } from "@/components/platform-sections";

type Props = PlatformSectionProps<"wordpress">;

const baseProps: Props = {
  platform: "wordpress",
  platformData: {} as any,
  snapshot: {},
  app: {},
};

describe("WordPressDescription", () => {
  const Section = wordpressSections.find((s) => s.id === "wordpress-description")!;
  const Component = Section.component;

  it("renders without errors with valid props", () => {
    const props: Props = {
      ...baseProps,
      platformData: { description: "<p>A great plugin</p>" } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("renders HTML description from platformData", () => {
    const props: Props = {
      ...baseProps,
      platformData: { description: "<p>Plugin description here</p>" } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Plugin description here")).toBeInTheDocument();
  });

  it("falls back to snapshot appDetails when no platformData description", () => {
    const props: Props = {
      ...baseProps,
      platformData: {} as any,
      snapshot: { appDetails: "Fallback description text" },
    };
    render(<Component {...props} />);
    expect(screen.getByText("Fallback description text")).toBeInTheDocument();
  });

  it("renders HTML with dangerouslySetInnerHTML for rich content", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        description: '<h4>Features</h4><ul><li>Feature 1</li></ul>',
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByText("Feature 1")).toBeInTheDocument();
  });

  it("handles missing data gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("shouldRender returns false when no description and no appDetails", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when platformData description exists", () => {
    const props: Props = {
      ...baseProps,
      platformData: { description: "<p>test</p>" } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });

  it("shouldRender returns true when snapshot appDetails exists", () => {
    const props: Props = {
      ...baseProps,
      snapshot: { appDetails: "test" },
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});
