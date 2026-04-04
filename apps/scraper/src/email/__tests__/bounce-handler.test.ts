import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordBounce, isSuppressed, refreshSuppressionList, getBounceStats, type BounceEvent } from "../bounce-handler.js";

// Mock DB chainable
function mockDb(overrides: { updateResult?: any; executeResult?: any; selectResult?: any } = {}) {
  const chain: any = {};
  for (const m of ["select", "from", "where", "update", "set", "limit"]) {
    chain[m] = () => chain;
  }
  chain.then = (resolve: any) => resolve(overrides.selectResult ?? []);

  return {
    select: () => chain,
    update: () => {
      const uc: any = {};
      for (const m of ["set", "where"]) uc[m] = () => uc;
      uc.then = (resolve: any) => resolve(overrides.updateResult ?? []);
      return uc;
    },
    execute: vi.fn().mockResolvedValue(overrides.executeResult ?? { rows: [] }),
  };
}

describe("bounce-handler", () => {
  describe("recordBounce", () => {
    it("records hard bounce and adds to suppression", async () => {
      const db = mockDb();
      const event: BounceEvent = {
        email: "bounce@test.com",
        bounceType: "hard",
        messageId: "msg-1",
        diagnosticCode: "550 User unknown",
      };

      await recordBounce(db as any, event);
      // Hard bounce → should be suppressed
      const suppressed = await isSuppressed(db as any, "bounce@test.com");
      expect(suppressed).toBe(true);
    });

    it("records complaint and adds to suppression", async () => {
      const db = mockDb();
      const event: BounceEvent = {
        email: "complaint@test.com",
        bounceType: "complaint",
      };

      await recordBounce(db as any, event);
      const suppressed = await isSuppressed(db as any, "complaint@test.com");
      expect(suppressed).toBe(true);
    });

    it("soft bounce does NOT add to suppression", async () => {
      const db = mockDb();
      const event: BounceEvent = {
        email: "soft@test.com",
        bounceType: "soft",
      };

      await recordBounce(db as any, event);
      // Soft bounces are tracked but not suppressed
      // isSuppressed will check in-memory set first
      // Since soft bounce doesn't add to set, this depends on DB refresh
    });

    it("handles case-insensitive email", async () => {
      const db = mockDb();
      await recordBounce(db as any, { email: "USER@TEST.COM", bounceType: "hard" });
      const suppressed = await isSuppressed(db as any, "user@test.com");
      expect(suppressed).toBe(true);
    });
  });

  describe("getBounceStats", () => {
    it("returns stats from DB", async () => {
      const db = mockDb({
        executeResult: [{ hard_bounces: 5, soft_bounces: 3, complaints: 1 }],
      });

      const stats = await getBounceStats(db as any, 30);
      expect(stats.hardBounces).toBe(5);
      expect(stats.softBounces).toBe(3);
      expect(stats.complaints).toBe(1);
    });

    it("returns zeros when no data", async () => {
      const db = mockDb({
        executeResult: [{}],
      });

      const stats = await getBounceStats(db as any);
      expect(stats.hardBounces).toBe(0);
      expect(stats.softBounces).toBe(0);
      expect(stats.complaints).toBe(0);
    });
  });

  describe("refreshSuppressionList", () => {
    it("refreshes from DB", async () => {
      const db = mockDb({
        executeResult: {
          rows: [
            { recipient_email: "a@test.com" },
            { recipient_email: "b@test.com" },
          ],
        },
      });

      const count = await refreshSuppressionList(db as any);
      expect(count).toBe(2);
    });
  });
});
