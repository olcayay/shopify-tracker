import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChangeHeatmap } from "@/components/changes/change-heatmap";
import type { ChangeEntry } from "@/components/changes/unified-change-log";

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

  it("returns null for empty entries", () => {
    const { container } = render(<ChangeHeatmap entries={[]} />);
    expect(container.innerHTML).toBe("");
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
    // Need entries in the older period so the component doesn't return null
    const olderDate = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
    const extendedEntries: ChangeEntry[] = [
      ...entries,
      { appSlug: "app-c", appName: "App C", isSelf: false, field: "name", oldValue: "O", newValue: "N", detectedAt: olderDate + "T10:00:00Z" },
    ];
    render(<ChangeHeatmap entries={extendedEntries} />);
    fireEvent.click(screen.getByLabelText("Previous period"));
    expect(screen.getByLabelText("Next period")).not.toBeDisabled();
  });
});
