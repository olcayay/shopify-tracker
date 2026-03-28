import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { PlatformFilterChips } from "@/components/platform-filter-chips";

describe("PlatformFilterChips", () => {
  it("renders nothing with single platform", () => {
    const { container } = render(
      <PlatformFilterChips
        enabledPlatforms={["shopify"]}
        activePlatforms={["shopify"]}
        onToggle={() => {}}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders chips for multiple platforms", () => {
    render(
      <PlatformFilterChips
        enabledPlatforms={["shopify", "salesforce", "hubspot"]}
        activePlatforms={["shopify", "salesforce", "hubspot"]}
        onToggle={() => {}}
      />
    );
    expect(screen.getByText("Shopify")).toBeInTheDocument();
    expect(screen.getByText("Salesforce")).toBeInTheDocument();
    expect(screen.getByText("HubSpot")).toBeInTheDocument();
  });

  it("calls onToggle when chip is clicked", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <PlatformFilterChips
        enabledPlatforms={["shopify", "salesforce"]}
        activePlatforms={["shopify", "salesforce"]}
        onToggle={onToggle}
      />
    );
    await user.click(screen.getByText("Salesforce"));
    expect(onToggle).toHaveBeenCalledWith("salesforce");
  });

  it("active chips have colored background", () => {
    render(
      <PlatformFilterChips
        enabledPlatforms={["shopify", "salesforce"]}
        activePlatforms={["shopify"]}
        onToggle={() => {}}
      />
    );
    const shopifyChip = screen.getByText("Shopify").closest("button");
    const salesforceChip = screen.getByText("Salesforce").closest("button");

    // Active chip has inline background color style
    expect(shopifyChip?.style.backgroundColor).toBeTruthy();
    // Inactive chip has no inline background color
    expect(salesforceChip?.style.backgroundColor).toBeFalsy();
  });
});
