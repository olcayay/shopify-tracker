import { describe, it, expect } from "vitest";
import { TAG_COLORS, getTagColorClasses } from "@/lib/tag-colors";

describe("TAG_COLORS", () => {
  it("has 10 color entries", () => {
    expect(TAG_COLORS).toHaveLength(10);
  });

  it("each entry has required fields", () => {
    for (const color of TAG_COLORS) {
      expect(color).toHaveProperty("key");
      expect(color).toHaveProperty("bg");
      expect(color).toHaveProperty("text");
      expect(color).toHaveProperty("border");
      expect(color).toHaveProperty("dot");
    }
  });

  it("has unique keys", () => {
    const keys = TAG_COLORS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("includes expected colors", () => {
    const keys = TAG_COLORS.map((c) => c.key);
    expect(keys).toContain("red");
    expect(keys).toContain("blue");
    expect(keys).toContain("emerald");
    expect(keys).toContain("violet");
    expect(keys).toContain("pink");
  });
});

describe("getTagColorClasses", () => {
  it("returns correct color for known key", () => {
    const red = getTagColorClasses("red");
    expect(red.key).toBe("red");
    expect(red.bg).toContain("red");
    expect(red.text).toContain("red");
  });

  it("returns correct color for blue", () => {
    const blue = getTagColorClasses("blue");
    expect(blue.key).toBe("blue");
    expect(blue.dot).toBe("bg-blue-500");
  });

  it("returns last color (rose) for unknown key", () => {
    const result = getTagColorClasses("unknown-color");
    expect(result.key).toBe("rose");
  });

  it("returns last color for empty string", () => {
    const result = getTagColorClasses("");
    expect(result.key).toBe("rose");
  });

  it("returns correct classes for each color", () => {
    for (const color of TAG_COLORS) {
      const result = getTagColorClasses(color.key);
      expect(result).toBe(color);
    }
  });

  it("bg classes contain opacity", () => {
    for (const color of TAG_COLORS) {
      expect(color.bg).toContain("/20");
    }
  });

  it("border classes contain opacity", () => {
    for (const color of TAG_COLORS) {
      expect(color.border).toContain("/50");
    }
  });
});
