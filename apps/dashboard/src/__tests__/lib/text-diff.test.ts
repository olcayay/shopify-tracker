import { describe, it, expect } from "vitest";
import { diffWords, diffArraySummary, type DiffSegment } from "@/lib/text-diff";

describe("diffWords", () => {
  it("returns empty for two empty strings", () => {
    expect(diffWords("", "")).toEqual([]);
  });

  it("returns added segment for empty old text", () => {
    const result = diffWords("", "hello world");
    expect(result).toEqual([{ type: "added", text: "hello world" }]);
  });

  it("returns removed segment for empty new text", () => {
    const result = diffWords("hello world", "");
    expect(result).toEqual([{ type: "removed", text: "hello world" }]);
  });

  it("returns equal segment for identical text", () => {
    const result = diffWords("hello world", "hello world");
    expect(result).toEqual([{ type: "equal", text: "hello world" }]);
  });

  it("detects word-level additions", () => {
    const result = diffWords("hello world", "hello beautiful world");
    expect(result.some((s) => s.type === "added" && s.text.includes("beautiful"))).toBe(true);
    expect(result.some((s) => s.type === "equal" && s.text.includes("hello"))).toBe(true);
  });

  it("detects word-level removals", () => {
    const result = diffWords("hello beautiful world", "hello world");
    expect(result.some((s) => s.type === "removed" && s.text.includes("beautiful"))).toBe(true);
  });

  it("handles complete replacement", () => {
    const result = diffWords("foo bar", "baz qux");
    const types = result.map((s) => s.type);
    expect(types).toContain("removed");
    expect(types).toContain("added");
  });

  it("handles null inputs gracefully", () => {
    expect(diffWords(null as unknown as string, "test")).toEqual([{ type: "added", text: "test" }]);
    expect(diffWords("test", null as unknown as string)).toEqual([{ type: "removed", text: "test" }]);
  });
});

describe("diffArraySummary", () => {
  it("returns empty for identical arrays", () => {
    const result = diffArraySummary(["a", "b"], ["a", "b"]);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it("detects added items", () => {
    const result = diffArraySummary(["a"], ["a", "b", "c"]);
    expect(result.added).toEqual(["b", "c"]);
    expect(result.removed).toEqual([]);
  });

  it("detects removed items", () => {
    const result = diffArraySummary(["a", "b", "c"], ["a"]);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual(["b", "c"]);
  });

  it("detects both added and removed", () => {
    const result = diffArraySummary(["a", "b"], ["b", "c"]);
    expect(result.added).toEqual(["c"]);
    expect(result.removed).toEqual(["a"]);
  });

  it("handles empty arrays", () => {
    expect(diffArraySummary([], ["a"])).toEqual({ added: ["a"], removed: [] });
    expect(diffArraySummary(["a"], [])).toEqual({ added: [], removed: ["a"] });
    expect(diffArraySummary([], [])).toEqual({ added: [], removed: [] });
  });
});
