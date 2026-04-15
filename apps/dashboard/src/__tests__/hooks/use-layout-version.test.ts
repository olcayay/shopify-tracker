import { describe, it, expect, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { buildAppLink, useLayoutVersion } from "@/hooks/use-layout-version";

function setCookie(value: string | null) {
  if (value == null) {
    document.cookie = "app-layout-version=; path=/; max-age=0";
  } else {
    document.cookie = `app-layout-version=${value}; path=/`;
  }
}

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
  afterEach(() => {
    setCookie(null);
  });

  // PLA-1110: hook now reads the `app-layout-version` cookie (previously
  // sniffed the URL, which broke when middleware switched from redirect →
  // rewrite and the URL no longer contained /v1/ or /v2/).
  it("returns v1 when app-layout-version=v1 cookie is set", () => {
    setCookie("v1");
    const { result } = renderHook(() => useLayoutVersion());
    expect(result.current).toBe("v1");
  });

  it("returns v2 when app-layout-version=v2 cookie is set", () => {
    setCookie("v2");
    const { result } = renderHook(() => useLayoutVersion());
    expect(result.current).toBe("v2");
  });

  it("defaults to v2 when cookie is unset", () => {
    setCookie(null);
    const { result } = renderHook(() => useLayoutVersion());
    expect(result.current).toBe("v2");
  });

  it("defaults to v2 when cookie has an unknown value", () => {
    document.cookie = "app-layout-version=bogus; path=/";
    const { result } = renderHook(() => useLayoutVersion());
    expect(result.current).toBe("v2");
  });
});
