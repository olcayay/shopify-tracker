import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { shopifySections } from "@/components/platform-sections/shopify-sections";
import type { PlatformSectionProps } from "@/components/platform-sections";

type Props = PlatformSectionProps<"shopify">;

const baseProps: Props = {
  platform: "shopify",
  platformData: {} as any,
  snapshot: {},
  app: {},
};

describe("ShopifySimilarApps", () => {
  const Section = shopifySections.find((s) => s.id === "shopify-similar-apps")!;
  const Component = Section.component;

  it("renders without errors with valid props", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        similarApps: [
          { slug: "pagefly", name: "PageFly" },
          { slug: "shogun", name: "Shogun" },
        ],
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("Similar Apps")).toBeInTheDocument();
  });

  it("renders similar app names as badges", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        similarApps: [
          { slug: "pagefly", name: "PageFly" },
          { slug: "shogun", name: "Shogun" },
        ],
      } as any,
    };
    render(<Component {...props} />);
    expect(screen.getByText("PageFly")).toBeInTheDocument();
    expect(screen.getByText("Shogun")).toBeInTheDocument();
  });

  it("renders links to Shopify app store", () => {
    const props: Props = {
      ...baseProps,
      platformData: {
        similarApps: [{ slug: "pagefly", name: "PageFly" }],
      } as any,
    };
    const { container } = render(<Component {...props} />);
    const link = container.querySelector('a[href="https://apps.shopify.com/pagefly"]');
    expect(link).toBeTruthy();
    expect(link?.getAttribute("target")).toBe("_blank");
  });

  it("handles empty similarApps gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("Similar Apps")).toBeInTheDocument();
  });

  it("shouldRender returns false when no similar apps", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when similar apps exist", () => {
    const props: Props = {
      ...baseProps,
      platformData: { similarApps: [{ slug: "x", name: "X" }] } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});

describe("ShopifyDemoStore", () => {
  const Section = shopifySections.find((s) => s.id === "shopify-demo-store")!;
  const Component = Section.component;

  it("renders demo store URL as a link", () => {
    const props: Props = {
      ...baseProps,
      platformData: { demoStoreUrl: "https://demo.example.com" } as any,
    };
    const { container } = render(<Component {...props} />);
    expect(screen.getByText("Demo Store")).toBeInTheDocument();
    const link = container.querySelector('a[href="https://demo.example.com"]');
    expect(link).toBeTruthy();
  });

  it("handles missing demoStoreUrl gracefully", () => {
    render(<Component {...baseProps} />);
    expect(screen.getByText("Demo Store")).toBeInTheDocument();
  });

  it("shouldRender returns false when no demo store URL", () => {
    expect(Section.shouldRender!(baseProps)).toBe(false);
  });

  it("shouldRender returns true when demo store URL exists", () => {
    const props: Props = {
      ...baseProps,
      platformData: { demoStoreUrl: "https://demo.example.com" } as any,
    };
    expect(Section.shouldRender!(props)).toBe(true);
  });
});
