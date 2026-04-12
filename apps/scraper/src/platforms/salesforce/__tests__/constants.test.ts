import { describe, it, expect } from "vitest";
import { SALESFORCE_CONSTANTS, SALESFORCE_CATEGORY_CHILDREN } from "../constants.js";

describe("SALESFORCE_CONSTANTS", () => {
  it("lists all 10 root categories as seeds", () => {
    expect(SALESFORCE_CONSTANTS.seedCategories).toHaveLength(10);
    expect(SALESFORCE_CONSTANTS.seedCategories).toEqual(
      expect.arrayContaining(Object.keys(SALESFORCE_CATEGORY_CHILDREN)),
    );
  });

  it("parallelises 5 seed categories (PLA-1052)", () => {
    expect(SALESFORCE_CONSTANTS.concurrentSeedCategories).toBe(5);
  });

  it("keeps rate-limit delays conservative enough for adaptive backoff", () => {
    expect(SALESFORCE_CONSTANTS.rateLimit?.minDelayMs).toBeGreaterThanOrEqual(100);
    expect(SALESFORCE_CONSTANTS.rateLimit?.maxDelayMs).toBeLessThanOrEqual(2000);
  });

  it("tracks the 6 expected snapshot fields", () => {
    expect(SALESFORCE_CONSTANTS.trackedFields).toEqual([
      "averageRating",
      "ratingCount",
      "description",
      "listingCategories",
      "publisher",
      "pricing",
    ]);
  });
});
