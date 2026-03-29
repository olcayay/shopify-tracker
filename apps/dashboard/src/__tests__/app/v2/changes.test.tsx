import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetApp = vi.fn();
const mockGetAppChanges = vi.fn();
const mockGetAppCompetitors = vi.fn();

vi.mock("@/lib/api", () => ({
  getApp: (...args: any[]) => mockGetApp(...args),
  getAppChanges: (...args: any[]) => mockGetAppChanges(...args),
  getAppCompetitors: (...args: any[]) => mockGetAppCompetitors(...args),
}));

vi.mock("@/components/v2/unified-change-log", () => ({
  UnifiedChangeLog: ({ entries }: { entries: any[] }) => (
    <div data-testid="change-log">
      {entries.length === 0 ? (
        <p>No changes</p>
      ) : (
        entries.map((e: any, i: number) => (
          <div key={i} data-testid="change-entry">
            {e.appName}: {e.field}
          </div>
        ))
      )}
    </div>
  ),
  // Need to export the ChangeEntry type mock too since it's imported
}));

import V2ChangesPage from "@/app/(dashboard)/[platform]/apps/v2/[slug]/intel/changes/page";

function renderAsync(jsx: Promise<React.JSX.Element>) {
  return jsx.then((el) => render(el));
}

const params = Promise.resolve({ platform: "shopify", slug: "test-app" });

describe("V2ChangesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Change Log heading", async () => {
    mockGetApp.mockResolvedValue({ slug: "test-app", name: "Test App", isTrackedByAccount: false });
    mockGetAppChanges.mockResolvedValue([]);
    await renderAsync(V2ChangesPage({ params }));
    expect(screen.getByText("Change Log")).toBeInTheDocument();
  });

  it("shows self changes in the log", async () => {
    mockGetApp.mockResolvedValue({ slug: "test-app", name: "Test App", isTrackedByAccount: false });
    mockGetAppChanges.mockResolvedValue([
      { field: "name", oldValue: "Old", newValue: "New", detectedAt: "2026-03-01" },
    ]);
    await renderAsync(V2ChangesPage({ params }));
    expect(screen.getByText("Test App: name")).toBeInTheDocument();
  });

  it("fetches competitor changes when tracked", async () => {
    mockGetApp.mockResolvedValue({ slug: "test-app", name: "Test App", isTrackedByAccount: true });
    mockGetAppChanges.mockImplementation((slug: string) => {
      if (slug === "test-app") return Promise.resolve([{ field: "name", oldValue: "A", newValue: "B", detectedAt: "2026-03-02" }]);
      if (slug === "comp-1") return Promise.resolve([{ field: "price", oldValue: "10", newValue: "20", detectedAt: "2026-03-01" }]);
      return Promise.resolve([]);
    });
    mockGetAppCompetitors.mockResolvedValue([{ slug: "comp-1", name: "Comp 1" }]);
    await renderAsync(V2ChangesPage({ params }));
    expect(screen.getByText("Test App: name")).toBeInTheDocument();
    expect(screen.getByText("Comp 1: price")).toBeInTheDocument();
  });

  it("handles empty changes gracefully", async () => {
    mockGetApp.mockResolvedValue({ slug: "test-app", name: "Test App", isTrackedByAccount: false });
    mockGetAppChanges.mockResolvedValue([]);
    await renderAsync(V2ChangesPage({ params }));
    expect(screen.getByTestId("change-log")).toBeInTheDocument();
    expect(screen.getByText("No changes")).toBeInTheDocument();
  });

  it("shows error on API failure", async () => {
    mockGetApp.mockRejectedValue(new Error("fail"));
    await renderAsync(V2ChangesPage({ params }));
    expect(screen.getByText("Failed to load changes.")).toBeInTheDocument();
  });

  it("sorts entries by date descending", async () => {
    mockGetApp.mockResolvedValue({ slug: "test-app", name: "Test App", isTrackedByAccount: false });
    mockGetAppChanges.mockResolvedValue([
      { field: "description", oldValue: "A", newValue: "B", detectedAt: "2026-03-01" },
      { field: "name", oldValue: "C", newValue: "D", detectedAt: "2026-03-05" },
    ]);
    await renderAsync(V2ChangesPage({ params }));
    const entries = screen.getAllByTestId("change-entry");
    expect(entries[0]).toHaveTextContent("Test App: name");
    expect(entries[1]).toHaveTextContent("Test App: description");
  });
});
