import { describe, it, expect, vi } from "vitest";
import { buildAppLink } from "@/hooks/use-layout-version";

// Mock next/navigation for useLayoutVersion
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

describe("buildAppLink", () => {
  it("builds v1 link with subpath", () => {
    expect(buildAppLink("shopify", "my-app", "reviews", "v1")).toBe(
      "/shopify/apps/v1/my-app/reviews"
    );
  });

  it("builds v2 link with subpath", () => {
    expect(buildAppLink("shopify", "my-app", "reviews", "v2")).toBe(
      "/shopify/apps/v2/my-app/reviews"
    );
  });

  it("builds v1 link without subpath", () => {
    expect(buildAppLink("shopify", "my-app", "", "v1")).toBe(
      "/shopify/apps/v1/my-app"
    );
  });

  it("builds v2 link without subpath", () => {
    expect(buildAppLink("salesforce", "cool-app", "", "v2")).toBe(
      "/salesforce/apps/v2/cool-app"
    );
  });

  it("defaults to v2 when no version specified", () => {
    expect(buildAppLink("shopify", "my-app", "keywords")).toBe(
      "/shopify/apps/v2/my-app/keywords"
    );
  });

  it("handles subpaths with hash fragments", () => {
    expect(buildAppLink("shopify", "my-app", "details#pricing-plans", "v1")).toBe(
      "/shopify/apps/v1/my-app/details#pricing-plans"
    );
  });
});

describe("useLayoutVersion", () => {
  it("returns v1 when pathname includes /apps/v1/", async () => {
    const { usePathname } = await import("next/navigation");
    (usePathname as any).mockReturnValue("/shopify/apps/v1/my-app/reviews");

    const { useLayoutVersion } = await import("@/hooks/use-layout-version");
    expect(useLayoutVersion()).toBe("v1");
  });

  it("returns v2 when pathname includes /apps/v2/", async () => {
    const { usePathname } = await import("next/navigation");
    (usePathname as any).mockReturnValue("/shopify/apps/v2/my-app");

    const { useLayoutVersion } = await import("@/hooks/use-layout-version");
    expect(useLayoutVersion()).toBe("v2");
  });

  it("returns v2 for unknown paths", async () => {
    const { usePathname } = await import("next/navigation");
    (usePathname as any).mockReturnValue("/shopify/apps/my-app");

    const { useLayoutVersion } = await import("@/hooks/use-layout-version");
    expect(useLayoutVersion()).toBe("v2");
  });
});
