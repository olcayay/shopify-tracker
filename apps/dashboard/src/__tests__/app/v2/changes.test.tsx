import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetApp = vi.fn();
const mockGetAppChangesFeed = vi.fn();

vi.mock("@/lib/api", () => ({
  getEnabledFeatures: vi.fn().mockResolvedValue([]),
  getApp: (...args: any[]) => mockGetApp(...args),
  getAppChangesFeed: (...args: any[]) => mockGetAppChangesFeed(...args),
}));

import { fetchChangeEntries } from "@/components/changes/fetch-change-entries";

describe("fetchChangeEntries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns self changes for untracked app", async () => {
    mockGetApp.mockResolvedValue({ name: "Test App", isTrackedByAccount: false });
    mockGetAppChangesFeed.mockResolvedValue({
      selfChanges: [{ field: "name", oldValue: "Old", newValue: "New", detectedAt: "2026-03-01" }],
      competitorChanges: {},
    });

    const { app, entries } = await fetchChangeEntries("test-app", "shopify");
    expect(app.name).toBe("Test App");
    expect(entries).toHaveLength(1);
    expect(entries[0].isSelf).toBe(true);
    expect(entries[0].appSlug).toBe("test-app");
    expect(entries[0].field).toBe("name");
  });

  it("includes competitor changes from batch response", async () => {
    mockGetApp.mockResolvedValue({ name: "Test App", isTrackedByAccount: true });
    mockGetAppChangesFeed.mockResolvedValue({
      selfChanges: [{ field: "name", oldValue: "A", newValue: "B", detectedAt: "2026-03-02" }],
      competitorChanges: {
        "comp-1": [{ field: "price", oldValue: "10", newValue: "20", detectedAt: "2026-03-01", appName: "Comp 1" }],
      },
    });

    const { entries } = await fetchChangeEntries("test-app", "shopify");
    expect(entries).toHaveLength(2);
    expect(entries[0].isSelf).toBe(true);
    expect(entries[1].isSelf).toBe(false);
    expect(entries[1].appName).toBe("Comp 1");
  });

  it("sorts entries by date descending", async () => {
    mockGetApp.mockResolvedValue({ name: "Test App", isTrackedByAccount: false });
    mockGetAppChangesFeed.mockResolvedValue({
      selfChanges: [
        { field: "description", oldValue: "A", newValue: "B", detectedAt: "2026-03-01" },
        { field: "name", oldValue: "C", newValue: "D", detectedAt: "2026-03-05" },
      ],
      competitorChanges: {},
    });

    const { entries } = await fetchChangeEntries("test-app", "shopify");
    expect(entries[0].field).toBe("name");
    expect(entries[1].field).toBe("description");
  });

  it("handles feed fetch errors gracefully", async () => {
    mockGetApp.mockResolvedValue({ name: "Test App", isTrackedByAccount: true });
    mockGetAppChangesFeed.mockRejectedValue(new Error("fail"));

    const { entries } = await fetchChangeEntries("test-app", "shopify");
    expect(entries).toHaveLength(0);
  });

  it("handles empty changes", async () => {
    mockGetApp.mockResolvedValue({ name: "Test App", isTrackedByAccount: false });
    mockGetAppChangesFeed.mockResolvedValue({ selfChanges: [], competitorChanges: {} });

    const { entries } = await fetchChangeEntries("test-app", "shopify");
    expect(entries).toHaveLength(0);
  });

  it("makes only 2 API calls total (app + changes-feed)", async () => {
    mockGetApp.mockResolvedValue({ name: "Test App", isTrackedByAccount: true });
    mockGetAppChangesFeed.mockResolvedValue({
      selfChanges: [{ field: "name", oldValue: "A", newValue: "B", detectedAt: "2026-03-01" }],
      competitorChanges: {
        "c1": [{ field: "price", oldValue: "5", newValue: "10", detectedAt: "2026-03-01", appName: "C1" }],
        "c2": [{ field: "desc", oldValue: "x", newValue: "y", detectedAt: "2026-03-01", appName: "C2" }],
      },
    });

    await fetchChangeEntries("test-app", "shopify");
    expect(mockGetApp).toHaveBeenCalledTimes(1);
    expect(mockGetAppChangesFeed).toHaveBeenCalledTimes(1);
  });

  it("handles null app gracefully", async () => {
    mockGetApp.mockResolvedValue(null);
    mockGetAppChangesFeed.mockResolvedValue({ selfChanges: [], competitorChanges: {} });

    const { app, entries } = await fetchChangeEntries("missing-app", "shopify");
    expect(app.slug).toBe("missing-app");
    expect(entries).toHaveLength(0);
  });
});
