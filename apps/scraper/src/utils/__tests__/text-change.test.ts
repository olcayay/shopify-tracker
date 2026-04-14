import { describe, expect, it } from "vitest";
import { isCaseOnlyDiff } from "../text-change.js";

describe("isCaseOnlyDiff", () => {
  it("returns true when strings differ only in letter case", () => {
    expect(isCaseOnlyDiff("Jotform", "JotForm")).toBe(true);
    expect(isCaseOnlyDiff("ACME", "acme")).toBe(true);
    expect(isCaseOnlyDiff("hello world", "Hello World")).toBe(true);
  });

  it("returns false when strings are exactly equal (no diff to guard)", () => {
    expect(isCaseOnlyDiff("Jotform", "Jotform")).toBe(false);
  });

  it("returns false when strings differ beyond case (real change)", () => {
    expect(isCaseOnlyDiff("Jotform", "Jotform Pro")).toBe(false);
    expect(isCaseOnlyDiff("Acme", "Acme, Inc.")).toBe(false);
    expect(isCaseOnlyDiff("Hello", "Hi")).toBe(false);
  });

  it("returns false for null/undefined/empty inputs (first-time population is a real change)", () => {
    expect(isCaseOnlyDiff(null, "Jotform")).toBe(false);
    expect(isCaseOnlyDiff("Jotform", null)).toBe(false);
    expect(isCaseOnlyDiff(undefined, "Jotform")).toBe(false);
    expect(isCaseOnlyDiff("", "Jotform")).toBe(false);
    expect(isCaseOnlyDiff(null, null)).toBe(false);
  });

  it("handles non-ASCII letter casing consistently (Turkish i, etc.)", () => {
    // Standard Latin: JavaScript toLowerCase agrees.
    expect(isCaseOnlyDiff("İSTANBUL", "istanbul")).toBe(false); // Turkish dotted I is a real difference under non-locale lowercase
    // But a normal brand re-case that maps under default lowercase still matches:
    expect(isCaseOnlyDiff("CANVA", "Canva")).toBe(true);
  });
});
