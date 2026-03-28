import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { PlatformBadgeCell } from "@/components/platform-badge-cell";

describe("PlatformBadgeCell", () => {
  it("renders platform name", () => {
    render(<PlatformBadgeCell platform="shopify" />);
    expect(screen.getByText("Shopify")).toBeInTheDocument();
  });

  it("renders colored dot", () => {
    const { container } = render(<PlatformBadgeCell platform="salesforce" />);
    const dot = container.querySelector("span > span");
    expect(dot?.style.backgroundColor).toBeTruthy();
  });

  it("handles unknown platform gracefully", () => {
    render(<PlatformBadgeCell platform="unknown" />);
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });
});
