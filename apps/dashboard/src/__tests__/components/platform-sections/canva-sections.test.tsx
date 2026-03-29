import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { canvaSections } from "@/components/platform-sections/canva-sections";
import type { PlatformSectionProps } from "@/components/platform-sections";

type Props = PlatformSectionProps<"canva">;

const baseProps: Props = {
  platform: "canva",
  platformData: {} as any,
  snapshot: {},
  app: {},
};

describe("CanvaPermissions", () => {
  const Section = canvaSections.find((s) => s.id === "canva-permissions")!;
  const Component = Section.component;

  it("renders without errors with valid props", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        permissions: [{ scope: "design:read", type: "MANDATORY" }],
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Permissions")).toBeInTheDocument();
  });

  it("renders permissions with scope and type", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        permissions: [
          { scope: "design:read", type: "MANDATORY" },
          { scope: "profile:read", type: "OPTIONAL" },
        ],
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText(/design:read/)).toBeInTheDocument();
    expect(screen.getByText(/\(mandatory\)/)).toBeInTheDocument();
    expect(screen.getByText(/profile:read/)).toBeInTheDocument();
    expect(screen.getByText(/\(optional\)/)).toBeInTheDocument();
  });

  it("handles empty permissions gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("Permissions")).toBeInTheDocument();
  });

  it("shouldRender returns false when no permissions", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when permissions exist", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        permissions: [{ scope: "design:read", type: "MANDATORY" }],
      } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});

describe("CanvaTopics", () => {
  const Section = canvaSections.find((s) => s.id === "canva-topics")!;
  const Component = Section.component;

  it("renders topics with prefix stripped", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        topics: ["marketplace_topic.design", "marketplace_topic.photography"],
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Topics")).toBeInTheDocument();
    expect(screen.getByText("design")).toBeInTheDocument();
    expect(screen.getByText("photography")).toBeInTheDocument();
  });

  it("handles topics without prefix", () => {
    const props: Props = {
      ...baseProps,
      platformData: { topics: ["branding"] } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("branding")).toBeInTheDocument();
  });

  it("handles empty topics gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("Topics")).toBeInTheDocument();
  });
});

describe("CanvaDeveloperInfo", () => {
  const Section = canvaSections.find((s) => s.id === "canva-developer-info")!;
  const Component = Section.component;

  it("renders developer email, phone, and address", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        developerEmail: "dev@example.com",
        developerPhone: "+1234567890",
        developerAddress: { street: "123 Main St", city: "SF", country: "US" },
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Developer Info")).toBeInTheDocument();
    expect(screen.getByText("dev@example.com")).toBeInTheDocument();
    expect(screen.getByText("+1234567890")).toBeInTheDocument();
    expect(screen.getByText("123 Main St, SF, US")).toBeInTheDocument();
  });

  it("renders mailto link for email", () => {
    const props: Props = {
      ...baseProps,
      platformData: { developerEmail: "dev@example.com" } as any,
    };
    const { container } = render(<Component {...props} />);
    const link = container.querySelector('a[href="mailto:dev@example.com"]');
    expect(link).toBeTruthy();
  });

  it("handles missing developer info gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("Developer Info")).toBeInTheDocument();
  });

  it("shouldRender returns true when email exists", () => {
    const props: Props = {
      ...baseProps,
      platformData: { developerEmail: "dev@example.com" } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});

describe("CanvaLinks", () => {
  const Section = canvaSections.find((s) => s.id === "canva-links")!;
  const Component = Section.component;

  it("renders terms and privacy links", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        termsUrl: "https://example.com/terms",
        privacyUrl: "https://example.com/privacy",
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Links")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/terms")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/privacy")).toBeInTheDocument();
  });

  it("shouldRender returns false when no links", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when termsUrl exists", () => {
    const props: Props = {
      ...baseProps,
      platformData: { termsUrl: "https://example.com/terms" } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});
