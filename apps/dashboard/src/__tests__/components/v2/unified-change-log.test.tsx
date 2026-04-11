import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import React from "react";
import { UnifiedChangeLog, type ChangeEntry } from "@/components/changes/unified-change-log";

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
    // Rival App entry link should be gone (text may still appear in app filter dropdown)
    expect(screen.queryAllByRole("link", { name: "Rival App" })).toHaveLength(0);
  });

  it("filters by source - competitors only", () => {
    render(<UnifiedChangeLog entries={entries} />);
    fireEvent.click(screen.getByText("Competitors"));
    const myAppElements = screen.getAllByText("Rival App");
    expect(myAppElements.length).toBeGreaterThan(0);
  });

  it("filters by field", () => {
    render(<UnifiedChangeLog entries={entries} />);
    const selects = screen.getAllByRole("combobox");
    const fieldSelect = selects[0]; // First select is field filter
    fireEvent.change(fieldSelect, { target: { value: "name" } });
    // Only the name change should show — Rival App entry link should be gone
    expect(screen.queryAllByRole("link", { name: "Rival App" })).toHaveLength(0);
    // My App still visible as entry link
    expect(screen.getAllByRole("link", { name: "My App" }).length).toBeGreaterThanOrEqual(1);
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

  it("shows app filter dropdown with unique app names", () => {
    render(<UnifiedChangeLog entries={entries} />);
    // App filter should be present (more than 1 app)
    const selects = screen.getAllByRole("combobox");
    const appSelect = selects[1]; // Second select is app filter
    expect(appSelect).toBeInTheDocument();
    // Check options: All apps + My App + Rival App
    const options = within(appSelect).getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent("All apps");
    expect(options.map((o) => o.textContent)).toContain("My App");
    expect(options.map((o) => o.textContent)).toContain("Rival App");
  });

  it("filters by app when app is selected", () => {
    render(<UnifiedChangeLog entries={entries} />);
    const selects = screen.getAllByRole("combobox");
    const appSelect = selects[1];
    // Select "Rival App"
    fireEvent.change(appSelect, { target: { value: "rival" } });
    // Only Rival App entries should show
    expect(screen.getAllByText("Rival App").length).toBeGreaterThan(0);
    // My App entries should be hidden (but "My App" button in source filter remains)
    const myAppLinks = screen.queryAllByRole("link", { name: "My App" });
    expect(myAppLinks).toHaveLength(0);
  });

  it("shows all entries when 'All apps' is selected", () => {
    render(<UnifiedChangeLog entries={entries} />);
    const selects = screen.getAllByRole("combobox");
    const appSelect = selects[1];
    // Filter to rival first
    fireEvent.change(appSelect, { target: { value: "rival" } });
    expect(screen.queryAllByRole("link", { name: "My App" })).toHaveLength(0);
    // Reset to all
    fireEvent.change(appSelect, { target: { value: "all" } });
    expect(screen.getAllByRole("link", { name: "My App" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Rival App" }).length).toBeGreaterThan(0);
  });

  it("app filter works with source and field filters combined", () => {
    const multiEntries: ChangeEntry[] = [
      { appSlug: "app-a", appName: "App A", isSelf: true, field: "name", oldValue: "O", newValue: "N", detectedAt: now.toISOString() },
      { appSlug: "app-a", appName: "App A", isSelf: true, field: "features", oldValue: "[]", newValue: "[]", detectedAt: now.toISOString() },
      { appSlug: "app-b", appName: "App B", isSelf: false, field: "name", oldValue: "X", newValue: "Y", detectedAt: now.toISOString() },
      { appSlug: "app-b", appName: "App B", isSelf: false, field: "features", oldValue: "[]", newValue: "[]", detectedAt: now.toISOString() },
    ];
    render(<UnifiedChangeLog entries={multiEntries} />);

    // Filter to App B + name field
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "app-b" } }); // app filter
    fireEvent.change(selects[0], { target: { value: "name" } }); // field filter

    // Only App B's name change should show
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("App B");
  });

  it("hides app filter when only one app exists", () => {
    const singleAppEntries: ChangeEntry[] = [
      { appSlug: "my-app", appName: "My App", isSelf: true, field: "name", oldValue: "O", newValue: "N", detectedAt: now.toISOString() },
    ];
    render(<UnifiedChangeLog entries={singleAppEntries} />);
    // Only field filter select should exist (no app filter)
    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(1);
  });

  it("resets page when app filter changes", () => {
    const manyEntries: ChangeEntry[] = Array.from({ length: 25 }, (_, i) => ({
      appSlug: i < 15 ? "app-a" : "app-b",
      appName: i < 15 ? "App A" : "App B",
      isSelf: true,
      field: "name",
      oldValue: `Old ${i}`,
      newValue: `New ${i}`,
      detectedAt: new Date(now.getTime() - i * 60000).toISOString(),
    }));
    render(<UnifiedChangeLog entries={manyEntries} />);

    // Go to page 2
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText(/page 2 of 2/i)).toBeInTheDocument();

    // Change app filter — should reset to page 1
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "app-a" } });
    expect(screen.queryByText(/page 2/i)).not.toBeInTheDocument();
  });

  it("shows list/calendar view toggle buttons", () => {
    render(<UnifiedChangeLog entries={entries} />);
    expect(screen.getByLabelText("List view")).toBeInTheDocument();
    expect(screen.getByLabelText("Calendar view")).toBeInTheDocument();
  });

  it("defaults to list view", () => {
    render(<UnifiedChangeLog entries={entries} />);
    // List view shows entries and Collapse All button
    expect(screen.getByText("Collapse All")).toBeInTheDocument();
    // Calendar view elements should not be present
    expect(screen.queryByLabelText("Previous period")).not.toBeInTheDocument();
  });

  it("switches to calendar view when calendar button clicked", () => {
    render(<UnifiedChangeLog entries={entries} />);
    fireEvent.click(screen.getByLabelText("Calendar view"));
    // Calendar view should show navigation and legend
    expect(screen.getByLabelText("Previous period")).toBeInTheDocument();
    expect(screen.getByText("Less")).toBeInTheDocument();
    // List-specific elements should be hidden
    expect(screen.queryByText("Collapse All")).not.toBeInTheDocument();
  });

  it("switches back to list view", () => {
    render(<UnifiedChangeLog entries={entries} />);
    fireEvent.click(screen.getByLabelText("Calendar view"));
    fireEvent.click(screen.getByLabelText("List view"));
    expect(screen.getByText("Collapse All")).toBeInTheDocument();
    expect(screen.queryByLabelText("Previous period")).not.toBeInTheDocument();
  });

  it("calendar view respects filters", () => {
    render(<UnifiedChangeLog entries={entries} />);
    // Filter to self only
    fireEvent.click(screen.getByRole("button", { name: "My App" }));
    // Switch to calendar
    fireEvent.click(screen.getByLabelText("Calendar view"));
    // Rival App should not appear in calendar
    expect(screen.queryByRole("link", { name: "Rival App" })).not.toBeInTheDocument();
  });
});
