import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChangeHeatmap } from "@/components/changes/change-heatmap";
import type { ChangeEntry } from "@/components/changes/unified-change-log";

vi.mock("next/navigation", () => ({
  usePathname: () => "/shopify/apps/v1/test-app/changes",
}));

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

const entries: ChangeEntry[] = [
  { appSlug: "app-a", appName: "App A", isSelf: true, field: "name", oldValue: "Old", newValue: "New", detectedAt: today + "T10:00:00Z" },
  { appSlug: "app-a", appName: "App A", isSelf: true, field: "features", oldValue: "[]", newValue: "[]", detectedAt: today + "T11:00:00Z" },
  { appSlug: "app-b", appName: "App B", isSelf: false, field: "pricingPlans", oldValue: "[]", newValue: "[]", detectedAt: yesterday + "T10:00:00Z" },
];

describe("ChangeHeatmap", () => {
  it("renders app rows from entries", () => {
    render(<ChangeHeatmap entries={entries} />);
    expect(screen.getByText("App A")).toBeInTheDocument();
    expect(screen.getByText("App B")).toBeInTheDocument();
  });

  it("shows empty state with navigation for empty entries", () => {
    render(<ChangeHeatmap entries={[]} />);
    expect(screen.getByText("No changes detected in this period.")).toBeInTheDocument();
    expect(screen.getByLabelText("Previous period")).toBeInTheDocument();
    expect(screen.getByLabelText("Next period")).toBeInTheDocument();
  });

  it("shows 'You' badge for self apps", () => {
    render(<ChangeHeatmap entries={entries} />);
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("renders legend", () => {
    render(<ChangeHeatmap entries={entries} />);
    expect(screen.getByText("Less")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();
  });

  it("renders time navigation controls", () => {
    render(<ChangeHeatmap entries={entries} />);
    expect(screen.getByLabelText("Previous period")).toBeInTheDocument();
    expect(screen.getByLabelText("Next period")).toBeInTheDocument();
    expect(screen.getByText(/—/)).toBeInTheDocument();
  });

  it("cell tooltip includes changed field names", () => {
    render(<ChangeHeatmap entries={entries} platform="shopify" />);
    // Find cells with title containing field labels
    const cells = document.querySelectorAll("[title]");
    const appACellTitles = [...cells].map((c) => c.getAttribute("title")).filter((t) => t?.includes("App A"));
    // App A has 2 changes today: "App Name" and "Features"
    const todayCell = appACellTitles.find((t) => t?.includes("2 changes"));
    expect(todayCell).toBeDefined();
    expect(todayCell).toContain("App Name");
    expect(todayCell).toContain("Features");
  });

  it("sorts rows by total activity descending", () => {
    render(<ChangeHeatmap entries={entries} />);
    const links = screen.getAllByRole("link");
    // App A has 2 changes, App B has 1 — App A should be first
    expect(links[0]).toHaveTextContent("App A");
    expect(links[1]).toHaveTextContent("App B");
  });

  it("disables Newer button at current period", () => {
    render(<ChangeHeatmap entries={entries} />);
    expect(screen.getByLabelText("Next period")).toBeDisabled();
  });

  it("enables Newer button after navigating to older period", () => {
    const olderDate = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
    const extendedEntries: ChangeEntry[] = [
      ...entries,
      { appSlug: "app-c", appName: "App C", isSelf: false, field: "name", oldValue: "O", newValue: "N", detectedAt: olderDate + "T10:00:00Z" },
    ];
    render(<ChangeHeatmap entries={extendedEntries} />);
    fireEvent.click(screen.getByLabelText("Previous period"));
    expect(screen.getByLabelText("Next period")).not.toBeDisabled();
  });

  it("keeps navigation visible when navigating to an empty period", () => {
    // Create entries with a gap — current period has data, 90 days ago has data,
    // so navigating to the middle period (30-60 days ago) should show empty state
    const oldDate = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const gapEntries: ChangeEntry[] = [
      ...entries,
      { appSlug: "app-old", appName: "Old App", isSelf: false, field: "name", oldValue: "O", newValue: "N", detectedAt: oldDate + "T10:00:00Z" },
    ];
    render(<ChangeHeatmap entries={gapEntries} />);
    expect(screen.getByText("App A")).toBeInTheDocument();

    // Navigate to older period (30-60 days ago) — no data there
    fireEvent.click(screen.getByLabelText("Previous period"));
    // Navigation should still be visible
    expect(screen.getByLabelText("Previous period")).toBeInTheDocument();
    expect(screen.getByLabelText("Next period")).toBeInTheDocument();
    // Empty state message shown
    expect(screen.getByText("No changes detected in this period.")).toBeInTheDocument();
  });

  it("recovers from empty period via Newer button", () => {
    const oldDate = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const gapEntries: ChangeEntry[] = [
      ...entries,
      { appSlug: "app-old", appName: "Old App", isSelf: false, field: "name", oldValue: "O", newValue: "N", detectedAt: oldDate + "T10:00:00Z" },
    ];
    render(<ChangeHeatmap entries={gapEntries} />);
    // Navigate to empty period
    fireEvent.click(screen.getByLabelText("Previous period"));
    expect(screen.getByText("No changes detected in this period.")).toBeInTheDocument();
    // Navigate back
    fireEvent.click(screen.getByLabelText("Next period"));
    expect(screen.getByText("App A")).toBeInTheDocument();
    expect(screen.queryByText("No changes detected in this period.")).not.toBeInTheDocument();
  });

  it("disables Older button when past earliest data point", () => {
    // Only today's entries — Older should be disabled immediately since all data is in current window
    const todayOnlyEntries: ChangeEntry[] = [
      { appSlug: "app-a", appName: "App A", isSelf: true, field: "name", oldValue: "O", newValue: "N", detectedAt: today + "T10:00:00Z" },
    ];
    render(<ChangeHeatmap entries={todayOnlyEntries} />);
    // Current window includes today, and earliest entry is today — can't go older
    expect(screen.getByLabelText("Previous period")).toBeDisabled();
  });

  it("disables Older button for empty entries", () => {
    render(<ChangeHeatmap entries={[]} />);
    expect(screen.getByLabelText("Previous period")).toBeDisabled();
  });

  it("renders app links without /intel/overview", () => {
    render(<ChangeHeatmap entries={entries} platform="shopify" />);
    const link = screen.getByRole("link", { name: "App A" });
    expect(link.getAttribute("href")).not.toContain("/intel/overview");
    expect(link).toHaveAttribute("href", "/shopify/apps/app-a");
  });
});
