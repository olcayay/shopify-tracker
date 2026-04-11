import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

  it("entries are expanded by default showing diff content", () => {
    render(<UnifiedChangeLog entries={entries} />);
    // Entries should be expanded by default — diffs visible without clicking
    expect(screen.getByText("Old Name")).toBeInTheDocument();
    expect(screen.getByText("New Name")).toBeInTheDocument();
  });

  it("collapses entry when clicked and re-expands on second click", () => {
    render(<UnifiedChangeLog entries={entries} />);
    // Initially expanded
    expect(screen.getByText("Old Name")).toBeInTheDocument();

    // Click to collapse
    const entryButtons = screen.getAllByRole("button").filter((btn) =>
      btn.closest("[class*='rounded-lg border']") && btn.textContent?.includes("My App")
    );
    fireEvent.click(entryButtons[0]);
    expect(screen.queryByText("Old Name")).not.toBeInTheDocument();

    // Click again to re-expand
    fireEvent.click(entryButtons[0]);
    expect(screen.getByText("Old Name")).toBeInTheDocument();
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

  it("renders features array diff correctly (expanded by default)", () => {
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

    // Expanded by default — details already visible
    expect(screen.getByText("Reporting")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Export")).toBeInTheDocument();
  });

  it("renders app names as clickable links", () => {
    render(<UnifiedChangeLog entries={entries} platform="shopify" />);
    const appLinks = screen.getAllByRole("link", { name: "My App" });
    expect(appLinks.length).toBeGreaterThan(0);
    expect(appLinks[0]).toHaveAttribute("href", "/shopify/apps/v2/my-app/intel/overview");

    const rivalLinks = screen.getAllByRole("link", { name: "Rival App" });
    expect(rivalLinks.length).toBeGreaterThan(0);
    expect(rivalLinks[0]).toHaveAttribute("href", "/shopify/apps/v2/rival/intel/overview");
  });

  it("Collapse All / Expand All toggle works", () => {
    render(<UnifiedChangeLog entries={entries} />);
    // Initially all expanded — diffs visible
    expect(screen.getByText("Old Name")).toBeInTheDocument();

    // Click Collapse All
    fireEvent.click(screen.getByText("Collapse All"));
    expect(screen.queryByText("Old Name")).not.toBeInTheDocument();

    // Click Expand All
    fireEvent.click(screen.getByText("Expand All"));
    expect(screen.getByText("Old Name")).toBeInTheDocument();
  });

  it("shows pagination when entries exceed page size", () => {
    // Create 25 entries (PAGE_SIZE is 20)
    const manyEntries: ChangeEntry[] = Array.from({ length: 25 }, (_, i) => ({
      appSlug: "test",
      appName: `App ${i}`,
      isSelf: true,
      field: "name",
      oldValue: `Old ${i}`,
      newValue: `New ${i}`,
      detectedAt: new Date(now.getTime() - i * 60000).toISOString(),
    }));
    render(<UnifiedChangeLog entries={manyEntries} />);

    // Should show pagination
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();

    // First page shows 20 entries
    expect(screen.getByText("App 0")).toBeInTheDocument();
    expect(screen.getByText("App 19")).toBeInTheDocument();
    expect(screen.queryByText("App 20")).not.toBeInTheDocument();

    // Navigate to page 2
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText(/page 2 of 2/i)).toBeInTheDocument();
    expect(screen.getByText("App 20")).toBeInTheDocument();
    expect(screen.queryByText("App 0")).not.toBeInTheDocument();
  });

  it("resets page to 1 when filters change", () => {
    const manyEntries: ChangeEntry[] = Array.from({ length: 25 }, (_, i) => ({
      appSlug: "test",
      appName: `App ${i}`,
      isSelf: i < 20,
      field: "name",
      oldValue: `Old ${i}`,
      newValue: `New ${i}`,
      detectedAt: new Date(now.getTime() - i * 60000).toISOString(),
    }));
    render(<UnifiedChangeLog entries={manyEntries} />);

    // Go to page 2
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText(/page 2 of 2/i)).toBeInTheDocument();

    // Change source filter — should reset to page 1
    fireEvent.click(screen.getByRole("button", { name: "Competitors" }));
    // Only 5 competitor entries, no pagination needed
    expect(screen.queryByText(/page 2/i)).not.toBeInTheDocument();
  });

  it("does not show pagination when entries fit in one page", () => {
    render(<UnifiedChangeLog entries={entries} />);
    expect(screen.queryByText(/page/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Previous")).not.toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });
});
