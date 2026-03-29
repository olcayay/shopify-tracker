import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { googleWorkspaceSections } from "@/components/platform-sections/google-workspace-sections";
import type { PlatformSectionProps } from "@/components/platform-sections";

type Props = PlatformSectionProps<"google_workspace">;

const baseProps: Props = {
  platform: "google_workspace",
  platformData: {} as any,
  snapshot: {},
  app: {},
};

describe("GoogleWorkspaceLinks", () => {
  const Section = googleWorkspaceSections.find((s) => s.id === "gws-links")!;
  const Component = Section.component;

  it("renders without errors with valid props", () => {
    const props: Props = {
      ...baseProps,
      platformData: { supportUrl: "https://support.example.com" } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Links")).toBeInTheDocument();
  });

  it("renders all link types", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        supportUrl: "https://support.example.com",
        developerWebsite: "https://dev.example.com",
        privacyPolicyUrl: "https://privacy.example.com",
        termsOfServiceUrl: "https://tos.example.com",
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("https://support.example.com")).toBeInTheDocument();
    expect(screen.getByText("https://dev.example.com")).toBeInTheDocument();
    expect(screen.getByText("https://privacy.example.com")).toBeInTheDocument();
    expect(screen.getByText("https://tos.example.com")).toBeInTheDocument();
  });

  it("renders labels for each link", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        supportUrl: "https://support.example.com",
        developerWebsite: "https://dev.example.com",
        privacyPolicyUrl: "https://privacy.example.com",
        termsOfServiceUrl: "https://tos.example.com",
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Support:")).toBeInTheDocument();
    expect(screen.getByText("Developer Website:")).toBeInTheDocument();
    expect(screen.getByText("Privacy Policy:")).toBeInTheDocument();
    expect(screen.getByText("Terms of Service:")).toBeInTheDocument();
  });

  it("links open in new tab", () => {
    const props: Props = {
      ...baseProps,
      platformData: { supportUrl: "https://support.example.com" } as any,
    };
    const { container } = render(<Component {...props} />);
    const link = container.querySelector('a[href="https://support.example.com"]');
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("handles missing links gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("Links")).toBeInTheDocument();
    expect(screen.queryByText("Support:")).not.toBeInTheDocument();
  });

  it("shouldRender returns false when no links", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when supportUrl exists", () => {
    const props: Props = {
      ...baseProps,
      platformData: { supportUrl: "https://support.example.com" } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });

  it("shouldRender returns true when only developerWebsite exists", () => {
    const props: Props = {
      ...baseProps,
      platformData: { developerWebsite: "https://dev.example.com" } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});
