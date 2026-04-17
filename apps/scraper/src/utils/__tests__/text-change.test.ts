import { describe, expect, it } from "vitest";
import { isCaseOnlyDiff, classifyNameChange } from "../text-change.js";

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

describe("classifyNameChange", () => {
  it("rejects when new name equals old subtitle (cross-field contamination)", () => {
    const result = classifyNameChange(
      "Mobile Forms by FieldKo",
      "Build inspection checklists in minutes",
      { oldSubtitle: "Build inspection checklists in minutes" }
    );
    expect(result.accept).toBe(false);
    expect(result.labels).toContain("title-subtitle-conflict");
  });

  it("rejects when new name equals old introduction", () => {
    const result = classifyNameChange(
      "Real App Title",
      "This app helps you do things",
      { oldIntroduction: "This app helps you do things" }
    );
    expect(result.accept).toBe(false);
    expect(result.labels).toContain("title-subtitle-conflict");
  });

  it("rejects when new name equals current subtitle", () => {
    const result = classifyNameChange(
      "Real App Title",
      "The best CRM tool",
      { newSubtitle: "The best CRM tool" }
    );
    expect(result.accept).toBe(false);
    expect(result.labels).toContain("title-subtitle-conflict");
  });

  it("comparison is case-insensitive", () => {
    const result = classifyNameChange(
      "Real App Title",
      "BUILD CHECKLISTS FAST",
      { oldSubtitle: "Build Checklists Fast" }
    );
    expect(result.accept).toBe(false);
  });

  it("soft-labels dramatic shortening (>=50%) but still accepts", () => {
    const result = classifyNameChange(
      "Mobile Forms, Tables & Checklists for Salesforce by FieldKo",
      "Mobile Forms"
    );
    expect(result.accept).toBe(true);
    expect(result.labels).toContain("title-subtitle-conflict");
  });

  it("does not label minor shortening (<50%)", () => {
    const result = classifyNameChange(
      "Mobile Forms by FieldKo",
      "Mobile Forms by FK"
    );
    expect(result.accept).toBe(true);
    expect(result.labels).toHaveLength(0);
  });

  it("accepts legitimate rebrand with similar length", () => {
    const result = classifyNameChange("Old Brand Name Pro", "New Brand Name Plus");
    expect(result.accept).toBe(true);
    expect(result.labels).toHaveLength(0);
  });

  it("does not trigger shortening rule when old name is very short", () => {
    const result = classifyNameChange("App", "AB");
    expect(result.accept).toBe(true);
    expect(result.labels).toHaveLength(0);
  });
});
