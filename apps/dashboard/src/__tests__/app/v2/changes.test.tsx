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
    mockGetAppCompetitors.mockResolvedValue([]);

    const { app, entries } = await fetchChangeEntries("test-app", "shopify");
    expect(app.name).toBe("Test App");
    expect(entries).toHaveLength(1);
    expect(entries[0].isSelf).toBe(true);
    expect(entries[0].appSlug).toBe("test-app");
    expect(entries[0].field).toBe("name");
    // Only 1 getAppChanges call (self), no separate competitor calls
    expect(mockGetAppChanges).toHaveBeenCalledTimes(1);
  });

  it("includes competitor changes from batch response", async () => {
    mockGetApp.mockResolvedValue({ name: "Test App", isTrackedByAccount: true });
    mockGetAppChanges.mockResolvedValue([
      { field: "name", oldValue: "A", newValue: "B", detectedAt: "2026-03-02" },
    ]);
    // getAppCompetitors with includeChanges=true returns recentChanges embedded
    mockGetAppCompetitors.mockResolvedValue([
      {
        appSlug: "comp-1",
        appName: "Comp 1",
        recentChanges: [
          { field: "price", oldValue: "10", newValue: "20", detectedAt: "2026-03-01" },
        ],
      },
    ]);

    const { entries } = await fetchChangeEntries("test-app", "shopify");
    expect(entries).toHaveLength(2);
    expect(entries[0].isSelf).toBe(true);
    expect(entries[1].isSelf).toBe(false);
    expect(entries[1].appName).toBe("Comp 1");
    // Competitors are fetched with includeChanges=true — third arg is true
    expect(mockGetAppCompetitors).toHaveBeenCalledWith("test-app", "shopify", true);
  });

  it("sorts entries by date descending", async () => {
    mockGetApp.mockResolvedValue({ name: "Test App", isTrackedByAccount: false });
    mockGetAppChanges.mockResolvedValue([
      { field: "description", oldValue: "A", newValue: "B", detectedAt: "2026-03-01" },
      { field: "name", oldValue: "C", newValue: "D", detectedAt: "2026-03-05" },
    ]);
    mockGetAppCompetitors.mockResolvedValue([]);

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
    mockGetAppCompetitors.mockResolvedValue([]);

    const { entries } = await fetchChangeEntries("test-app", "shopify");
    expect(entries).toHaveLength(0);
  });

  it("limits to 10 competitors from batch response", async () => {
    mockGetApp.mockResolvedValue({ name: "Test App", isTrackedByAccount: true });
    mockGetAppChanges.mockResolvedValue([]);
    // API returns 15 competitors with changes
    const competitors = Array.from({ length: 15 }, (_, i) => ({
      appSlug: `comp-${i}`,
      appName: `Comp ${i}`,
      recentChanges: [{ field: "name", oldValue: "A", newValue: "B", detectedAt: "2026-03-01" }],
    }));
    mockGetAppCompetitors.mockResolvedValue(competitors);

    const { entries } = await fetchChangeEntries("test-app", "shopify");
    // Only 10 competitors' changes included (1 change each)
    expect(entries).toHaveLength(10);
    // Only 1 getAppChanges call (self) — no separate per-competitor calls
    expect(mockGetAppChanges).toHaveBeenCalledTimes(1);
  });

  it("makes only 3 API calls total (app + self changes + competitors batch)", async () => {
    mockGetApp.mockResolvedValue({ name: "Test App", isTrackedByAccount: true });
    mockGetAppChanges.mockResolvedValue([{ field: "name", oldValue: "A", newValue: "B", detectedAt: "2026-03-01" }]);
    mockGetAppCompetitors.mockResolvedValue([
      { appSlug: "c1", appName: "C1", recentChanges: [{ field: "price", oldValue: "5", newValue: "10", detectedAt: "2026-03-01" }] },
      { appSlug: "c2", appName: "C2", recentChanges: [{ field: "desc", oldValue: "x", newValue: "y", detectedAt: "2026-03-01" }] },
    ]);

    await fetchChangeEntries("test-app", "shopify");
    // Exactly 1 call each — no N+1
    expect(mockGetApp).toHaveBeenCalledTimes(1);
    expect(mockGetAppChanges).toHaveBeenCalledTimes(1);
    expect(mockGetAppCompetitors).toHaveBeenCalledTimes(1);
  });
});
