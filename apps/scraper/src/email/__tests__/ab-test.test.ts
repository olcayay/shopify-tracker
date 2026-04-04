import { describe, it, expect, beforeEach } from "vitest";
import {
  registerABTest,
  getActiveTest,
  selectVariant,
  getTestResults,
  _resetABTests,
  type ABTest,
} from "../ab-test.js";

const TEST_AB: ABTest = {
  id: "test-1",
  name: "Subject Line Test",
  emailType: "email_daily_digest",
  enabled: true,
  variants: [
    { id: "a", name: "Control", weight: 50, subject: "Your Daily Digest" },
    { id: "b", name: "Variant B", weight: 50, subject: "Daily App Rankings Update" },
  ],
};

describe("A/B test infrastructure", () => {
  beforeEach(() => {
    _resetABTests();
  });

  describe("registerABTest", () => {
    it("registers a valid test", () => {
      registerABTest(TEST_AB);
      expect(getActiveTest("email_daily_digest")).not.toBeNull();
    });

    it("throws when weights don't sum to 100", () => {
      expect(() =>
        registerABTest({
          ...TEST_AB,
          variants: [
            { id: "a", name: "A", weight: 30 },
            { id: "b", name: "B", weight: 30 },
          ],
        })
      ).toThrow("Variant weights must sum to 100");
    });
  });

  describe("getActiveTest", () => {
    it("returns null when no test for email type", () => {
      expect(getActiveTest("email_welcome")).toBeNull();
    });

    it("returns active test for matching email type", () => {
      registerABTest(TEST_AB);
      const test = getActiveTest("email_daily_digest");
      expect(test?.id).toBe("test-1");
    });

    it("returns null for disabled test", () => {
      registerABTest({ ...TEST_AB, enabled: false });
      expect(getActiveTest("email_daily_digest")).toBeNull();
    });

    it("respects date range", () => {
      const futureTest: ABTest = {
        ...TEST_AB,
        startDate: new Date(Date.now() + 86400000).toISOString(), // tomorrow
      };
      registerABTest(futureTest);
      expect(getActiveTest("email_daily_digest")).toBeNull();
    });
  });

  describe("selectVariant", () => {
    it("returns a variant", () => {
      registerABTest(TEST_AB);
      const variant = selectVariant(TEST_AB, "user-1");
      expect(["a", "b"]).toContain(variant.id);
    });

    it("returns same variant for same user (deterministic)", () => {
      registerABTest(TEST_AB);
      const v1 = selectVariant(TEST_AB, "user-1");
      const v2 = selectVariant(TEST_AB, "user-1");
      expect(v1.id).toBe(v2.id);
    });

    it("distributes users across variants", () => {
      registerABTest(TEST_AB);
      const counts: Record<string, number> = { a: 0, b: 0 };

      for (let i = 0; i < 100; i++) {
        const variant = selectVariant(TEST_AB, `user-${i}`);
        counts[variant.id]++;
      }

      // With 50/50 split and 100 users, each should get roughly 30-70
      expect(counts.a).toBeGreaterThan(20);
      expect(counts.b).toBeGreaterThan(20);
    });

    it("respects variant weights", () => {
      const unevenTest: ABTest = {
        ...TEST_AB,
        variants: [
          { id: "a", name: "Control", weight: 90 },
          { id: "b", name: "Variant", weight: 10 },
        ],
      };
      registerABTest(unevenTest);

      const counts: Record<string, number> = { a: 0, b: 0 };
      for (let i = 0; i < 200; i++) {
        const variant = selectVariant(unevenTest, `user-${i}`);
        counts[variant.id]++;
      }

      // 90/10 split — "a" should get significantly more
      expect(counts.a).toBeGreaterThan(counts.b);
    });
  });

  describe("getTestResults", () => {
    it("returns assignment counts per variant", () => {
      registerABTest(TEST_AB);
      for (let i = 0; i < 10; i++) {
        selectVariant(TEST_AB, `user-${i}`);
      }

      const results = getTestResults("test-1");
      expect(results.totalAssignments).toBe(10);
      expect(Object.keys(results.variantCounts).length).toBeGreaterThan(0);
    });

    it("returns zero for unknown test", () => {
      const results = getTestResults("nonexistent");
      expect(results.totalAssignments).toBe(0);
    });
  });
});
