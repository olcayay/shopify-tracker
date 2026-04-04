import { describe, it, expect } from "vitest";
import { evaluateCondition } from "../alert-evaluator.js";

describe("evaluateCondition", () => {
  describe("> operator", () => {
    it("returns true when value exceeds threshold", () => {
      expect(evaluateCondition(51, ">", 50)).toBe(true);
    });

    it("returns false when value equals threshold", () => {
      expect(evaluateCondition(50, ">", 50)).toBe(false);
    });

    it("returns false when value is below threshold", () => {
      expect(evaluateCondition(49, ">", 50)).toBe(false);
    });
  });

  describe(">= operator", () => {
    it("returns true when value equals threshold", () => {
      expect(evaluateCondition(50, ">=", 50)).toBe(true);
    });

    it("returns true when value exceeds threshold", () => {
      expect(evaluateCondition(51, ">=", 50)).toBe(true);
    });

    it("returns false when value is below threshold", () => {
      expect(evaluateCondition(49, ">=", 50)).toBe(false);
    });
  });

  describe("< operator", () => {
    it("returns true when value is below threshold", () => {
      expect(evaluateCondition(49, "<", 50)).toBe(true);
    });

    it("returns false when value equals threshold", () => {
      expect(evaluateCondition(50, "<", 50)).toBe(false);
    });
  });

  describe("<= operator", () => {
    it("returns true when value equals threshold", () => {
      expect(evaluateCondition(50, "<=", 50)).toBe(true);
    });

    it("returns false when value exceeds threshold", () => {
      expect(evaluateCondition(51, "<=", 50)).toBe(false);
    });
  });

  describe("== operator", () => {
    it("returns true when value equals threshold", () => {
      expect(evaluateCondition(50, "==", 50)).toBe(true);
    });

    it("returns false when value differs", () => {
      expect(evaluateCondition(51, "==", 50)).toBe(false);
    });
  });

  describe("unknown operator", () => {
    it("defaults to > behavior", () => {
      expect(evaluateCondition(51, "???", 50)).toBe(true);
      expect(evaluateCondition(50, "???", 50)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles zero threshold", () => {
      expect(evaluateCondition(1, ">", 0)).toBe(true);
      expect(evaluateCondition(0, ">", 0)).toBe(false);
    });

    it("handles zero value", () => {
      expect(evaluateCondition(0, "<", 1)).toBe(true);
    });

    it("handles large numbers", () => {
      expect(evaluateCondition(1000000, ">", 999999)).toBe(true);
    });
  });
});
