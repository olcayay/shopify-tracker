import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import {
  PlatformProvider,
  usePlatform,
  usePlatformOptional,
} from "../../contexts/platform-context";

function TestConsumer() {
  const { platformId, platform } = usePlatform();
  return (
    <div data-testid="platform">
      {platformId}-{platform.name}
    </div>
  );
}

function OptionalConsumer() {
  const result = usePlatformOptional();
  return (
    <div data-testid="optional">{result ? result.platformId : "none"}</div>
  );
}

describe("PlatformProvider", () => {
  it("renders children", () => {
    render(
      <PlatformProvider platformId="shopify">
        <span data-testid="child">Hello</span>
      </PlatformProvider>
    );
    expect(screen.getByTestId("child")).toHaveTextContent("Hello");
  });
});

describe("usePlatform", () => {
  it("returns platformId and platform config", () => {
    render(
      <PlatformProvider platformId="shopify">
        <TestConsumer />
      </PlatformProvider>
    );
    expect(screen.getByTestId("platform")).toHaveTextContent(
      "shopify-Shopify App Store"
    );
  });

  it("throws when used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      "usePlatform must be used within a PlatformProvider"
    );
    spy.mockRestore();
  });
});

describe("usePlatformOptional", () => {
  it("returns null outside provider", () => {
    render(<OptionalConsumer />);
    expect(screen.getByTestId("optional")).toHaveTextContent("none");
  });

  it("returns value inside provider", () => {
    render(
      <PlatformProvider platformId="shopify">
        <OptionalConsumer />
      </PlatformProvider>
    );
    expect(screen.getByTestId("optional")).toHaveTextContent("shopify");
  });
});

describe("multiple platforms", () => {
  it.each([
    ["shopify", "Shopify App Store"],
    ["salesforce", "Salesforce AppExchange"],
    ["canva", "Canva Apps"],
  ] as const)("works for %s", (platformId, expectedName) => {
    render(
      <PlatformProvider platformId={platformId}>
        <TestConsumer />
      </PlatformProvider>
    );
    expect(screen.getByTestId("platform")).toHaveTextContent(
      `${platformId}-${expectedName}`
    );
  });
});
