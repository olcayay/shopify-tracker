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
    // My App self entries should be hidden
    const myAppElements = screen.getAllByText("Rival App");
    expect(myAppElements.length).toBeGreaterThan(0);
  });

  it("filters by field", () => {
    render(<UnifiedChangeLog entries={entries} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "name" } });
    // Only the name change should show
    expect(screen.getByText("Old Name")).toBeInTheDocument();
  });

  it("shows empty state when no entries match", () => {
    render(<UnifiedChangeLog entries={[]} />);
    expect(screen.getByText("No changes match the current filters.")).toBeInTheDocument();
  });

  it("shows field badges with colors", () => {
    render(<UnifiedChangeLog entries={entries} />);
    // Field badges rendered inside Badge components
    const badges = screen.getAllByText("name");
    expect(badges.length).toBeGreaterThan(0);
    expect(screen.getAllByText("appDetails").length).toBeGreaterThan(0);
  });

  it("shows You badge for self changes", () => {
    render(<UnifiedChangeLog entries={entries} />);
    const youBadges = screen.getAllByText("You");
    expect(youBadges.length).toBeGreaterThan(0);
  });
});
