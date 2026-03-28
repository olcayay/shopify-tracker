import { describe, it, expect } from "vitest";
import {
  SEED_CATEGORY_SLUGS,
  MAX_CATEGORY_DEPTH,
} from "../constants/seed-categories.js";

describe("seed-categories", () => {
  describe("SEED_CATEGORY_SLUGS", () => {
    it("has exactly 6 entries", () => {
      expect(SEED_CATEGORY_SLUGS).toHaveLength(6);
    });

    it("each slug is a non-empty string", () => {
      for (const slug of SEED_CATEGORY_SLUGS) {
        expect(typeof slug).toBe("string");
        expect(slug.length).toBeGreaterThan(0);
      }
    });

    it("contains all expected slugs", () => {
      const expected = [
        "finding-products",
        "selling-products",
        "orders-and-shipping",
        "store-design",
        "marketing-and-conversion",
        "store-management",
      ];
      for (const slug of expected) {
        expect(SEED_CATEGORY_SLUGS).toContain(slug);
      }
    });

    it("has no duplicate slugs", () => {
      const unique = new Set(SEED_CATEGORY_SLUGS);
      expect(unique.size).toBe(SEED_CATEGORY_SLUGS.length);
    });
  });

  describe("MAX_CATEGORY_DEPTH", () => {
    it("is 4", () => {
      expect(MAX_CATEGORY_DEPTH).toBe(4);
    });
  });
});
