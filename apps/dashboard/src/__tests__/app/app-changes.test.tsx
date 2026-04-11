import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockFetchChangeEntries = vi.fn();

vi.mock("@/components/changes/fetch-change-entries", () => ({
  fetchChangeEntries: (...args: any[]) => mockFetchChangeEntries(...args),
}));

vi.mock("@/components/changes/unified-change-log", () => ({
  UnifiedChangeLog: ({ entries, platform }: { entries: any[]; platform: string }) => (
    <div data-testid="change-log" data-platform={platform}>
      {entries.map((e: any, i: number) => (
        <div key={i} data-testid="change-entry">
          {e.appName}: {e.field} ({e.isSelf ? "self" : "competitor"})
        </div>
      ))}
    </div>
  ),
}));

import ChangesPage from "@/app/(dashboard)/[platform]/apps/[slug]/changes/page";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((el) => render(el));
}

describe("ChangesPage (v1 — unified)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = Promise.resolve({ platform: "shopify", slug: "test-app" });

  it("renders empty state when no changes", async () => {
    mockFetchChangeEntries.mockResolvedValue({
      app: { name: "Test App", isTrackedByAccount: false },
      entries: [],
    });
    await renderAsync(ChangesPage({ params }));
    expect(
      screen.getByText("No listing changes detected yet.")
    ).toBeInTheDocument();
  });

  it("calls fetchChangeEntries with correct slug and platform", async () => {
    mockFetchChangeEntries.mockResolvedValue({
      app: { name: "Test App", isTrackedByAccount: false },
      entries: [],
    });
    await renderAsync(ChangesPage({ params }));
    expect(mockFetchChangeEntries).toHaveBeenCalledWith("test-app", "shopify");
  });

  it("renders Change Log heading with entries", async () => {
    mockFetchChangeEntries.mockResolvedValue({
      app: { name: "Test App", isTrackedByAccount: false },
      entries: [
        { appSlug: "test-app", appName: "Test App", isSelf: true, field: "name", oldValue: "Old", newValue: "New", detectedAt: "2026-03-01" },
      ],
    });
    await renderAsync(ChangesPage({ params }));
    expect(screen.getByText("Change Log")).toBeInTheDocument();
  });

  it("passes entries to UnifiedChangeLog", async () => {
    mockFetchChangeEntries.mockResolvedValue({
      app: { name: "Test App", isTrackedByAccount: true },
      entries: [
        { appSlug: "test-app", appName: "Test App", isSelf: true, field: "name", oldValue: "Old", newValue: "New", detectedAt: "2026-03-02" },
        { appSlug: "rival", appName: "Rival App", isSelf: false, field: "price", oldValue: "10", newValue: "20", detectedAt: "2026-03-01" },
      ],
    });
    await renderAsync(ChangesPage({ params }));
    expect(screen.getByText("Test App: name (self)")).toBeInTheDocument();
    expect(screen.getByText("Rival App: price (competitor)")).toBeInTheDocument();
  });

  it("passes platform to UnifiedChangeLog", async () => {
    mockFetchChangeEntries.mockResolvedValue({
      app: { name: "Test App", isTrackedByAccount: false },
      entries: [
        { appSlug: "test-app", appName: "Test App", isSelf: true, field: "name", oldValue: "Old", newValue: "New", detectedAt: "2026-03-01" },
      ],
    });
    await renderAsync(ChangesPage({ params }));
    expect(screen.getByTestId("change-log")).toHaveAttribute("data-platform", "shopify");
  });

  it("handles API error gracefully", async () => {
    mockFetchChangeEntries.mockRejectedValue(new Error("API error"));
    await renderAsync(ChangesPage({ params }));
    expect(
      screen.getByText("Failed to load changes.")
    ).toBeInTheDocument();
  });

  it("works with canva platform", async () => {
    const canvaParams = Promise.resolve({ platform: "canva", slug: "test-app" });
    mockFetchChangeEntries.mockResolvedValue({
      app: { name: "Canva App", isTrackedByAccount: false },
      entries: [
        { appSlug: "test-app", appName: "Canva App", isSelf: true, field: "appIntroduction", oldValue: "Old", newValue: "New", detectedAt: "2026-03-01" },
      ],
    });
    await renderAsync(ChangesPage({ params: canvaParams }));
    expect(screen.getByTestId("change-log")).toHaveAttribute("data-platform", "canva");
  });
});
