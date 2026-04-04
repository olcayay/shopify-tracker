import { describe, it, expect, vi } from "vitest";
import { cleanupOldNotifications, getRetentionStats } from "../../notifications/retention-cleanup.js";

describe("Notification Retention Cleanup", () => {
  const mockDb = {
    execute: vi.fn(),
  };

  it("cleanupOldNotifications returns result structure", async () => {
    // First call: delivery log deletion (returns 0 — done)
    // Second call: notification deletion (returns 0 — done)
    mockDb.execute
      .mockResolvedValueOnce({ rowCount: 0 }) // delivery log batch
      .mockResolvedValueOnce({ rowCount: 0 }); // notification batch

    const result = await cleanupOldNotifications(mockDb as any, 90);

    expect(result.retentionDays).toBe(90);
    expect(result.cutoffDate).toBeDefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.notificationsDeleted).toBe(0);
    expect(result.deliveryLogsDeleted).toBe(0);
  });

  it("cleanupOldNotifications batches deletions", async () => {
    // Simulate: first batch deletes 1000, second batch deletes 500
    mockDb.execute
      .mockResolvedValueOnce({ rowCount: 1000 }) // delivery log batch 1
      .mockResolvedValueOnce({ rowCount: 500 })  // delivery log batch 2
      .mockResolvedValueOnce({ rowCount: 1000 }) // notification batch 1
      .mockResolvedValueOnce({ rowCount: 200 });  // notification batch 2

    const result = await cleanupOldNotifications(mockDb as any, 30);

    expect(result.deliveryLogsDeleted).toBe(1500);
    expect(result.notificationsDeleted).toBe(1200);
    expect(result.retentionDays).toBe(30);
  });

  it("getRetentionStats returns counts without deleting", async () => {
    mockDb.execute
      .mockResolvedValueOnce({ rows: [{ count: 5000 }] })
      .mockResolvedValueOnce({ rows: [{ count: 1200 }] });

    const stats = await getRetentionStats(mockDb as any, 90);

    expect(stats.totalNotifications).toBe(5000);
    expect(stats.expiredNotifications).toBe(1200);
    expect(stats.retentionDays).toBe(90);
    expect(stats.cutoffDate).toBeDefined();
  });

  it("uses custom retention days", async () => {
    mockDb.execute
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 0 });

    const result = await cleanupOldNotifications(mockDb as any, 30);
    expect(result.retentionDays).toBe(30);

    // Cutoff should be ~30 days ago
    const cutoff = new Date(result.cutoffDate);
    const daysAgo = (Date.now() - cutoff.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysAgo).toBeGreaterThan(29);
    expect(daysAgo).toBeLessThan(31);
  });
});
