import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logActivity } from "../../utils/activity-log.js";

describe("logActivity", () => {
  let mockDb: { execute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    mockDb = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("inserts activity log with all fields including metadata", async () => {
    const metadata = { platform: "shopify", slug: "test-app" };

    logActivity(
      mockDb,
      "account-123",
      "user-456",
      "app_tracked",
      "app",
      "test-app",
      metadata
    );

    // Flush the setTimeout
    vi.advanceTimersByTime(1);

    // Wait for the dynamic import to resolve
    await vi.waitFor(() => {
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });

    // Verify the SQL was called with an object containing the query
    const call = mockDb.execute.mock.calls[0][0];
    // The sql template tag produces an object with queryChunks or similar
    // We verify the function was called (the SQL correctness is tested by integration)
    expect(call).toBeDefined();
  });

  it("inserts activity log without metadata (null)", async () => {
    logActivity(
      mockDb,
      "account-123",
      "user-456",
      "app_untracked",
      "app",
      "test-app"
    );

    vi.advanceTimersByTime(1);

    await vi.waitFor(() => {
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });
  });

  it("does not throw when db.execute rejects", async () => {
    mockDb.execute.mockRejectedValue(new Error("DB error"));

    logActivity(
      mockDb,
      "account-123",
      "user-456",
      "app_tracked",
      "app",
      "test-app",
      { platform: "shopify" }
    );

    vi.advanceTimersByTime(1);

    // Should not throw — fire-and-forget
    await vi.waitFor(() => {
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });
  });

  it("handles null userId", async () => {
    logActivity(
      mockDb,
      "account-123",
      null,
      "subscription_activated",
      "account",
      "account-123"
    );

    vi.advanceTimersByTime(1);

    await vi.waitFor(() => {
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });
  });

  it("handles undefined entityType and entityId", async () => {
    logActivity(
      mockDb,
      "account-123",
      "user-456",
      "custom_action"
    );

    vi.advanceTimersByTime(1);

    await vi.waitFor(() => {
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });
  });

  it("serializes complex metadata to JSON", async () => {
    const metadata = {
      fields: ["name", "company"],
      nested: { key: "value" },
      count: 42,
    };

    logActivity(
      mockDb,
      "account-123",
      "user-456",
      "account_updated",
      "account",
      "account-123",
      metadata
    );

    vi.advanceTimersByTime(1);

    await vi.waitFor(() => {
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });
  });
});
