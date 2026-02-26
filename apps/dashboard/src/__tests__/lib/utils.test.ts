import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn utility", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("handles undefined and null", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end");
  });

  it("merges conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("merges tailwind color utilities", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });

  it("handles array inputs via clsx", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("handles object inputs via clsx", () => {
    expect(cn({ hidden: true, visible: false })).toBe("hidden");
  });

  it("handles complex responsive classes", () => {
    expect(cn("md:px-2", "md:px-4")).toBe("md:px-4");
  });

  it("preserves non-conflicting classes", () => {
    expect(cn("p-2", "m-4", "text-sm")).toBe("p-2 m-4 text-sm");
  });
});
