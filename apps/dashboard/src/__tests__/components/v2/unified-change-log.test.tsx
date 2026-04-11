import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { UnifiedChangeLog, type ChangeEntry } from "@/components/v2/unified-change-log";

describe("UnifiedChangeLog", () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const lastWeek = new Date(now.getTime() - 5 * 86400000);

  const entries: ChangeEntry[] = [
    { appSlug: "my-app", appName: "My App", isSelf: true, field: "name", oldValue: "Old Name", newValue: "New Name", detectedAt: now.toISOString() },
    { appSlug: "rival", appName: "Rival App", isSelf: false, field: "appDetails", oldValue: "Old desc", newValue: "New desc", detectedAt: yesterday.toISOString() },
    { appSlug: "my-app", appName: "My App", isSelf: true, field: "pricingPlans", oldValue: "Free", newValue: "$9.99/mo", detectedAt: lastWeek.toISOString() },
  ];

  it("renders all entries by default", () => {
    render(<UnifiedChangeLog entries={entries} />);
    expect(screen.getAllByText("My App").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rival App").length).toBeGreaterThan(0);
  });

  it("shows time period groups", () => {
    render(<UnifiedChangeLog entries={entries} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("This Week")).toBeInTheDocument();
  });

  it("filters by source - self only", () => {
    render(<UnifiedChangeLog entries={entries} />);
    fireEvent.click(screen.getByRole("button", { name: "My App" }));
    expect(screen.queryByText("Rival App")).not.toBeInTheDocument();
  });

  it("filters by source - competitors only", () => {
    render(<UnifiedChangeLog entries={entries} />);
    fireEvent.click(screen.getByText("Competitors"));
    const myAppElements = screen.getAllByText("Rival App");
    expect(myAppElements.length).toBeGreaterThan(0);
  });

  it("filters by field", () => {
    render(<UnifiedChangeLog entries={entries} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "name" } });
    // Only the name change should show — Rival App should be gone
    expect(screen.queryByText("Rival App")).not.toBeInTheDocument();
    // My App still visible (both as filter button and as entry)
    expect(screen.getAllByText("My App").length).toBeGreaterThanOrEqual(1);
  });

  it("expands entry to show diff content", () => {
    render(<UnifiedChangeLog entries={entries} />);
    // Find clickable entry rows (buttons that contain app name)
    const entryButtons = screen.getAllByRole("button").filter((btn) =>
      btn.closest("[class*='rounded-lg border']") && btn.textContent?.includes("My App")
    );
    expect(entryButtons.length).toBeGreaterThan(0);
    fireEvent.click(entryButtons[0]);
    // Now the diff should be visible — short text shows old (red) → new (green)
    expect(screen.getByText("Old Name")).toBeInTheDocument();
    expect(screen.getByText("New Name")).toBeInTheDocument();
  });

  it("shows empty state when no entries match", () => {
    render(<UnifiedChangeLog entries={[]} />);
    expect(screen.getByText("No changes match the current filters.")).toBeInTheDocument();
  });

  it("shows field badges with platform labels", () => {
    render(<UnifiedChangeLog entries={entries} platform="shopify" />);
    // getFieldLabels("shopify") returns default labels: "App Name", "Details", "Pricing Plans"
    expect(screen.getAllByText("App Name").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Details").length).toBeGreaterThan(0);
  });

  it("shows default field labels when no platform provided", () => {
    render(<UnifiedChangeLog entries={entries} />);
    // Without platform, defaults to shopify labels — "App Name" for name field
    expect(screen.getAllByText("App Name").length).toBeGreaterThan(0);
  });

  it("shows You badge for self changes", () => {
    render(<UnifiedChangeLog entries={entries} />);
    const youBadges = screen.getAllByText("You");
    expect(youBadges.length).toBeGreaterThan(0);
  });

  it("shows change summary badges", () => {
    render(<UnifiedChangeLog entries={entries} />);
    // The "Updated" summary should appear for the name change
    expect(screen.getAllByText("Updated").length).toBeGreaterThan(0);
  });

  it("renders features array diff correctly when expanded", () => {
    const featureEntries: ChangeEntry[] = [
      {
        appSlug: "test",
        appName: "Test App",
        isSelf: true,
        field: "features",
        oldValue: JSON.stringify(["Analytics", "Reporting"]),
        newValue: JSON.stringify(["Analytics", "Dashboard", "Export"]),
        detectedAt: now.toISOString(),
      },
    ];
    render(<UnifiedChangeLog entries={featureEntries} />);
    // Summary should show added/removed counts
    expect(screen.getByText("+2, -1 features")).toBeInTheDocument();

    // Expand to see details
    fireEvent.click(screen.getByText("Test App"));
    expect(screen.getByText("Reporting")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Export")).toBeInTheDocument();
  });
});
