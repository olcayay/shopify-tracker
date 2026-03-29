import { describe, it, expect, vi } from "vitest";

// Mock dependencies
vi.mock("@appranks/shared", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { flattenBusinessNeeds } from "../../../platforms/salesforce/parsers/app-parser.js";

describe("flattenBusinessNeeds", () => {
  it("flattens nested object to array of selected keys", () => {
    const result = flattenBusinessNeeds({
      marketing: { categories: ["surveys"], isSelected: false },
      customerService: { categories: ["agentProductivity"], isSelected: true },
      analytics: { categories: ["reporting"], isSelected: true },
    });

    expect(result).toContain("customerService");
    expect(result).toContain("analytics");
    expect(result).not.toContain("marketing");
    expect(result).toHaveLength(2);
  });

  it("returns empty array when input is null", () => {
    expect(flattenBusinessNeeds(null)).toEqual([]);
  });

  it("returns empty array when input is undefined", () => {
    expect(flattenBusinessNeeds(undefined)).toEqual([]);
  });

  it("returns empty array when input is empty object", () => {
    expect(flattenBusinessNeeds({})).toEqual([]);
  });

  it("passes through if already an array", () => {
    expect(flattenBusinessNeeds(["sales", "marketing"])).toEqual(["sales", "marketing"]);
  });

  it("returns empty array when all isSelected are false", () => {
    const result = flattenBusinessNeeds({
      marketing: { categories: [], isSelected: false },
      sales: { categories: [], isSelected: false },
    });
    expect(result).toEqual([]);
  });

  it("handles entries with missing isSelected (treated as not selected)", () => {
    const result = flattenBusinessNeeds({
      marketing: { categories: ["email"] },
      sales: { categories: ["crm"], isSelected: true },
    });
    expect(result).toEqual(["sales"]);
  });

  it("returns empty array for non-object input (string, number)", () => {
    expect(flattenBusinessNeeds("not-an-object")).toEqual([]);
    expect(flattenBusinessNeeds(42)).toEqual([]);
  });
});
