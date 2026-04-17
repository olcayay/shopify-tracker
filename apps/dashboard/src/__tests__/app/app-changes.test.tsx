import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockFetchChangeEntries = vi.fn();

vi.mock("@/components/changes/fetch-change-entries", () => ({
  fetchChangeEntries: (...args: any[]) => mockFetchChangeEntries(...args),
}));

vi.mock("@/components/changes/unified-change-log", () => ({
  UnifiedChangeLog: ({ entries, platform, showSourceFilter }: { entries: any[]; platform: string; showSourceFilter?: boolean }) => (
    <div data-testid="change-log" data-platform={platform} data-show-source-filter={String(!!showSourceFilter)}>
      {entries.map((e: any, i: number) => (
        <div key={i} data-testid="change-entry">
          {e.appName}: {e.field} ({e.isSelf ? "self" : "competitor"})
        </div>
      ))}
    </div>
  ),
}));

import ChangesPage from "@/app/(dashboard)/[platform]/apps/[slug]/changes/page";
import V2ChangesPage from "@/app/(dashboard)/[platform]/apps/v2/[slug]/intel/changes/page";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((el) => render(el));
}

const params = Promise.resolve({ platform: "shopify", slug: "test-app" });

describe("ChangesPage (shared implementation)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders empty state when no changes", async () => {
    mockFetchChangeEntries.mockResolvedValue({ app: { name: "Test App" }, entries: [] });
    await renderAsync(ChangesPage({ params }));
    expect(screen.getByText("No listing changes detected yet.")).toBeInTheDocument();
  });

  it("calls fetchChangeEntries with correct slug and platform", async () => {
    mockFetchChangeEntries.mockResolvedValue({ app: { name: "Test App" }, entries: [] });
    await renderAsync(ChangesPage({ params }));
    expect(mockFetchChangeEntries).toHaveBeenCalledWith("test-app", "shopify");
  });

  it("renders Change Log heading with entries", async () => {
    mockFetchChangeEntries.mockResolvedValue({
      app: { name: "Test App" },
      entries: [
        { appSlug: "test-app", appName: "Test App", isSelf: true, field: "name", oldValue: "Old", newValue: "New", detectedAt: "2026-03-01" },
      ],
    });
    await renderAsync(ChangesPage({ params }));
    expect(screen.getByText("Change Log")).toBeInTheDocument();
  });

  it("passes entries and platform to UnifiedChangeLog", async () => {
    mockFetchChangeEntries.mockResolvedValue({
      app: { name: "Test App" },
      entries: [
        { appSlug: "test-app", appName: "Test App", isSelf: true, field: "name", oldValue: "Old", newValue: "New", detectedAt: "2026-03-02" },
        { appSlug: "rival", appName: "Rival App", isSelf: false, field: "price", oldValue: "10", newValue: "20", detectedAt: "2026-03-01" },
      ],
    });
    await renderAsync(ChangesPage({ params }));
    expect(screen.getByText("Test App: name (self)")).toBeInTheDocument();
    expect(screen.getByText("Rival App: price (competitor)")).toBeInTheDocument();
    expect(screen.getByTestId("change-log")).toHaveAttribute("data-platform", "shopify");
  });

  it("handles API error gracefully", async () => {
    mockFetchChangeEntries.mockRejectedValue(new Error("API error"));
    await renderAsync(ChangesPage({ params }));
    expect(screen.getByText("Failed to load changes.")).toBeInTheDocument();
  });

  it("passes showSourceFilter=true when app is tracked", async () => {
    mockFetchChangeEntries.mockResolvedValue({
      app: { name: "Test App", isTrackedByAccount: true },
      entries: [
        { appSlug: "test-app", appName: "Test App", isSelf: true, field: "name", oldValue: "Old", newValue: "New", detectedAt: "2026-03-01" },
      ],
    });
    await renderAsync(ChangesPage({ params }));
    expect(screen.getByTestId("change-log")).toHaveAttribute("data-show-source-filter", "true");
  });

  it("passes showSourceFilter=false when app is not tracked", async () => {
    mockFetchChangeEntries.mockResolvedValue({
      app: { name: "Test App", isTrackedByAccount: false },
      entries: [
        { appSlug: "test-app", appName: "Test App", isSelf: true, field: "name", oldValue: "Old", newValue: "New", detectedAt: "2026-03-01" },
      ],
    });
    await renderAsync(ChangesPage({ params }));
    expect(screen.getByTestId("change-log")).toHaveAttribute("data-show-source-filter", "false");
  });

  it("works with canva platform", async () => {
    const canvaParams = Promise.resolve({ platform: "canva", slug: "test-app" });
    mockFetchChangeEntries.mockResolvedValue({
      app: { name: "Canva App" },
      entries: [
        { appSlug: "test-app", appName: "Canva App", isSelf: true, field: "appIntroduction", oldValue: "Old", newValue: "New", detectedAt: "2026-03-01" },
      ],
    });
    await renderAsync(ChangesPage({ params: canvaParams }));
    expect(screen.getByTestId("change-log")).toHaveAttribute("data-platform", "canva");
  });
});

describe("V2ChangesPage — re-exports shared implementation", () => {
  it("is the same function as ChangesPage", () => {
    // V2 re-exports from the shared page — they are the same default export
    expect(V2ChangesPage).toBe(ChangesPage);
  });
});
