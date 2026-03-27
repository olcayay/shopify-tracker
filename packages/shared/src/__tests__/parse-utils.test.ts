import { describe, it, expect } from "vitest";
import { safeParseFloat, clampRating, clampCount, clampPosition } from "../parse-utils.js";

describe("safeParseFloat", () => {
  it("parses valid float strings", () => {
    expect(safeParseFloat("3.5")).toBe(3.5);
    expect(safeParseFloat("0")).toBe(0);
    expect(safeParseFloat("100")).toBe(100);
    expect(safeParseFloat("4.99")).toBe(4.99);
  });

  it("returns null for NaN-producing strings", () => {
    expect(safeParseFloat("abc")).toBeNull();
    expect(safeParseFloat("Free")).toBeNull();
    expect(safeParseFloat("Contact sales")).toBeNull();
    expect(safeParseFloat("N/A")).toBeNull();
  });

  it("returns null for null/undefined/empty", () => {
    expect(safeParseFloat(null)).toBeNull();
    expect(safeParseFloat(undefined)).toBeNull();
    expect(safeParseFloat("")).toBeNull();
  });

  it("uses fallback when provided", () => {
    expect(safeParseFloat("abc", 0)).toBe(0);
    expect(safeParseFloat(null, 0)).toBe(0);
    expect(safeParseFloat("", 0)).toBe(0);
  });

  it("ignores fallback for valid values", () => {
    expect(safeParseFloat("3.5", 0)).toBe(3.5);
  });

  it("handles edge cases", () => {
    expect(safeParseFloat("1,299.99")).toBe(1); // parseFloat stops at comma
    expect(safeParseFloat("$5.99")).toBeNull(); // starts with $
    expect(safeParseFloat("5.99/mo")).toBe(5.99); // parseFloat ignores trailing text
    expect(safeParseFloat("-1.5")).toBe(-1.5);
  });
});

describe("clampRating", () => {
  it("accepts valid ratings 0-5", () => {
    expect(clampRating(0)).toBe(0);
    expect(clampRating(3.5)).toBe(3.5);
    expect(clampRating(5)).toBe(5);
    expect(clampRating(4.99)).toBe(4.99);
  });

  it("rejects out-of-range ratings", () => {
    expect(clampRating(-1)).toBeNull();
    expect(clampRating(5.1)).toBeNull();
    expect(clampRating(7)).toBeNull();
    expect(clampRating(100)).toBeNull();
  });

  it("returns null for null/undefined/NaN", () => {
    expect(clampRating(null)).toBeNull();
    expect(clampRating(undefined)).toBeNull();
    expect(clampRating(NaN)).toBeNull();
  });
});

describe("clampCount", () => {
  it("accepts non-negative counts", () => {
    expect(clampCount(0)).toBe(0);
    expect(clampCount(100)).toBe(100);
    expect(clampCount(5.7)).toBe(5); // floors
  });

  it("rejects negative counts", () => {
    expect(clampCount(-1)).toBeNull();
    expect(clampCount(-100)).toBeNull();
  });

  it("returns null for null/undefined/NaN", () => {
    expect(clampCount(null)).toBeNull();
    expect(clampCount(undefined)).toBeNull();
    expect(clampCount(NaN)).toBeNull();
  });
});

describe("clampPosition", () => {
  it("accepts positive positions", () => {
    expect(clampPosition(1)).toBe(1);
    expect(clampPosition(50)).toBe(50);
    expect(clampPosition(1.9)).toBe(1); // floors
  });

  it("rejects zero or negative positions", () => {
    expect(clampPosition(0)).toBeNull();
    expect(clampPosition(-1)).toBeNull();
  });

  it("returns null for null/undefined/NaN", () => {
    expect(clampPosition(null)).toBeNull();
    expect(clampPosition(undefined)).toBeNull();
    expect(clampPosition(NaN)).toBeNull();
  });
});
