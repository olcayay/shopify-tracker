import { describe, it, expect } from "vitest";
import { parseHubSpotReviewPage } from "../review-parser.js";

describe("parseHubSpotReviewPage", () => {
  it("returns empty reviews (not available via CHIRP API)", () => {
    const result = parseHubSpotReviewPage("{}", 1);
    expect(result.reviews).toEqual([]);
  });

  it("returns hasNextPage false", () => {
    const result = parseHubSpotReviewPage("{}", 1);
    expect(result.hasNextPage).toBe(false);
  });

  it("passes through page number", () => {
    const result = parseHubSpotReviewPage("{}", 3);
    expect(result.currentPage).toBe(3);
  });

  it("handles any input string", () => {
    const result = parseHubSpotReviewPage("anything", 1);
    expect(result.reviews).toEqual([]);
  });
});
