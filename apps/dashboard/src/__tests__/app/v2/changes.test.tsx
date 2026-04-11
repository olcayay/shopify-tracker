import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetApp = vi.fn();
const mockGetAppChanges = vi.fn();
const mockGetAppCompetitors = vi.fn();

vi.mock("@/lib/api", () => ({
  getEnabledFeatures: vi.fn().mockResolvedValue([]),
  getApp: (...args: any[]) => mockGetApp(...args),
  getAppChanges: (...args: any[]) => mockGetAppChanges(...args),
  getAppCompetitors: (...args: any[]) => mockGetAppCompetitors(...args),
}));

import { fetchChangeEntries } from "@/components/changes/fetch-change-entries";

describe("fetchChangeEntries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns self changes for untracked app", async () => {
    mockGetApp.mockResolvedValue({ name: "Test App", isTrackedByAccount: false });
    mockGetAppChanges.mockResolvedValue([
      { field: "name", oldValue: "Old", newValue: "New", detectedAt: "2026-03-01" },
    ]);

    const { app, entries } = await fetchChangeEntries("test-app", "shopify");
    expect(app.name).toBe("Test App");
    expect(entries).toHaveLength(1);
    expect(entries[0].isSelf).toBe(true);
    expect(entries[0].appSlug).toBe("test-app");
    expect(entries[0].field).toBe("name");
    expect(mockGetAppCompetitors).not.toHaveBeenCalled();
  });

  it("includes competitor changes for tracked app", async () => {
    mockGetApp.mockResolvedValue({ name: "Test App", isTrackedByAccount: true });
    mockGetAppChanges.mockImplementation((slug: string) => {
      if (slug === "test-app") return Promise.resolve([{ field: "name", oldValue: "A", newValue: "B", detectedAt: "2026-03-02" }]);
      if (slug === "comp-1") return Promise.resolve([{ field: "price", oldValue: "10", newValue: "20", detectedAt: "2026-03-01" }]);
      return Promise.resolve([]);
    });
    mockGetAppCompetitors.mockResolvedValue([{ appSlug: "comp-1", appName: "Comp 1" }]);

    const { entries } = await fetchChangeEntries("test-app", "shopify");
    expect(entries).toHaveLength(2);
    expect(entries[0].isSelf).toBe(true);
    expect(entries[1].isSelf).toBe(false);
    expect(entries[1].appName).toBe("Comp 1");
  });

  it("sorts entries by date descending", async () => {
    mockGetApp.mockResolvedValue({ name: "Test App", isTrackedByAccount: false });
    mockGetAppChanges.mockResolvedValue([
      { field: "description", oldValue: "A", newValue: "B", detectedAt: "2026-03-01" },
      { field: "name", oldValue: "C", newValue: "D", detectedAt: "2026-03-05" },
    ]);

    const { entries } = await fetchChangeEntries("test-app", "shopify");
    expect(entries[0].field).toBe("name");
    expect(entries[1].field).toBe("description");
  });

  it("handles competitor fetch errors gracefully", async () => {
    mockGetApp.mockResolvedValue({ name: "Test App", isTrackedByAccount: true });
    mockGetAppChanges.mockResolvedValue([{ field: "name", oldValue: "A", newValue: "B", detectedAt: "2026-03-01" }]);
    mockGetAppCompetitors.mockRejectedValue(new Error("fail"));

    const { entries } = await fetchChangeEntries("test-app", "shopify");
    expect(entries).toHaveLength(1);
    expect(entries[0].isSelf).toBe(true);
  });

  it("handles empty changes", async () => {
    mockGetApp.mockResolvedValue({ name: "Test App", isTrackedByAccount: false });
    mockGetAppChanges.mockResolvedValue([]);

    const { entries } = await fetchChangeEntries("test-app", "shopify");
    expect(entries).toHaveLength(0);
  });

  it("limits to 10 competitors", async () => {
    mockGetApp.mockResolvedValue({ name: "Test App", isTrackedByAccount: true });
    mockGetAppChanges.mockResolvedValue([]);
    const competitors = Array.from({ length: 15 }, (_, i) => ({ appSlug: `comp-${i}`, appName: `Comp ${i}` }));
    mockGetAppCompetitors.mockResolvedValue(competitors);

    await fetchChangeEntries("test-app", "shopify");
    // 1 call for self + 10 for competitors (max)
    expect(mockGetAppChanges).toHaveBeenCalledTimes(11);
  });
});
