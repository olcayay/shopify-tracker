import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PlatformColorDot } from "@/components/ui/platform-color-dot";

describe("PlatformColorDot", () => {
  it("renders a dot with platform color", () => {
    const { container } = render(<PlatformColorDot platformId="shopify" />);
    const dot = container.querySelector("span");
    expect(dot).toBeTruthy();
    expect(dot?.style.backgroundColor).toBeTruthy();
  });

  it("renders default size (h-2 w-2)", () => {
    const { container } = render(<PlatformColorDot platformId="shopify" />);
    const dot = container.querySelector("span");
    expect(dot?.className).toContain("h-2");
    expect(dot?.className).toContain("w-2");
  });

  it("renders small size (h-1.5 w-1.5)", () => {
    const { container } = render(<PlatformColorDot platformId="shopify" size="sm" />);
    const dot = container.querySelector("span");
    expect(dot?.className).toContain("h-1.5");
    expect(dot?.className).toContain("w-1.5");
  });

  it("renders large size (h-2.5 w-2.5)", () => {
    const { container } = render(<PlatformColorDot platformId="shopify" size="lg" />);
    const dot = container.querySelector("span");
    expect(dot?.className).toContain("h-2.5");
    expect(dot?.className).toContain("w-2.5");
  });

  it("is always rounded-full", () => {
    const { container } = render(<PlatformColorDot platformId="shopify" />);
    const dot = container.querySelector("span");
    expect(dot?.className).toContain("rounded-full");
  });

  it("accepts custom className", () => {
    const { container } = render(<PlatformColorDot platformId="shopify" className="mr-2" />);
    const dot = container.querySelector("span");
    expect(dot?.className).toContain("mr-2");
  });

  it("works with different platforms", () => {
    const { container: c1 } = render(<PlatformColorDot platformId="shopify" />);
    const { container: c2 } = render(<PlatformColorDot platformId="salesforce" />);
    const dot1 = c1.querySelector("span");
    const dot2 = c2.querySelector("span");
    // Different platforms should have different colors
    expect(dot1?.style.backgroundColor).not.toBe(dot2?.style.backgroundColor);
  });
});
