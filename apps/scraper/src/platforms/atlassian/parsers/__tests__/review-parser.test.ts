import { describe, it, expect } from "vitest";
import { parseAtlassianReviewPage } from "../review-parser.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const REVIEW_JSON = {
  count: 85,
  _embedded: {
    reviews: [
      {
        stars: 5,
        review: "Excellent plugin, very useful for our team.",
        date: "2025-11-20T14:30:00Z",
        _embedded: {
          author: { name: "Alice Johnson", displayName: "alice.j" },
        },
      },
      {
        stars: 3,
        body: "Decent but could use more configuration options.",
        date: "2025-10-05T09:00:00Z",
        _embedded: {
          author: { displayName: "bob_dev" },
        },
      },
      {
        stars: 1,
        review: "Does not work with Data Center.",
        date: "2025-09-15T18:45:00Z",
        _embedded: {
          author: {},
        },
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseAtlassianReviewPage", () => {
  it("parses reviews from API JSON response", () => {
    const result = parseAtlassianReviewPage(REVIEW_JSON, 1, 0);
    expect(result.reviews).toHaveLength(3);
    expect(result.currentPage).toBe(1);
  });

  it("extracts rating from stars field", () => {
    const result = parseAtlassianReviewPage(REVIEW_JSON, 1, 0);
    expect(result.reviews[0].rating).toBe(5);
    expect(result.reviews[1].rating).toBe(3);
    expect(result.reviews[2].rating).toBe(1);
  });

  it("extracts review content from review or body field", () => {
    const result = parseAtlassianReviewPage(REVIEW_JSON, 1, 0);
    expect(result.reviews[0].content).toBe("Excellent plugin, very useful for our team.");
    expect(result.reviews[1].content).toBe("Decent but could use more configuration options.");
  });

  it("converts ISO date to YYYY-MM-DD format", () => {
    const result = parseAtlassianReviewPage(REVIEW_JSON, 1, 0);
    expect(result.reviews[0].reviewDate).toBe("2025-11-20");
    expect(result.reviews[1].reviewDate).toBe("2025-10-05");
    expect(result.reviews[2].reviewDate).toBe("2025-09-15");
  });

  it("extracts reviewer name from author.name or displayName, falls back to Anonymous", () => {
    const result = parseAtlassianReviewPage(REVIEW_JSON, 1, 0);
    expect(result.reviews[0].reviewerName).toBe("Alice Johnson");
    expect(result.reviews[1].reviewerName).toBe("bob_dev");
    expect(result.reviews[2].reviewerName).toBe("Anonymous");
  });

  it("determines hasNextPage based on offset + count vs total", () => {
    // Page 1 with offset 0: 3 reviews fetched out of 85 total
    const result = parseAtlassianReviewPage(REVIEW_JSON, 1, 0);
    expect(result.hasNextPage).toBe(true);
  });

  it("sets hasNextPage to false when all reviews have been fetched", () => {
    const lastPageJson = {
      count: 3,
      _embedded: { reviews: REVIEW_JSON._embedded.reviews },
    };
    const result = parseAtlassianReviewPage(lastPageJson, 1, 0);
    expect(result.hasNextPage).toBe(false);
  });

  it("handles empty reviews array", () => {
    const emptyJson = { count: 0, _embedded: { reviews: [] } };
    const result = parseAtlassianReviewPage(emptyJson, 1, 0);
    expect(result.reviews).toHaveLength(0);
    expect(result.hasNextPage).toBe(false);
    expect(result.currentPage).toBe(1);
  });

  it("handles missing _embedded gracefully", () => {
    const noEmbedded = { count: 0 };
    const result = parseAtlassianReviewPage(noEmbedded, 1, 0);
    expect(result.reviews).toHaveLength(0);
  });

  it("sets empty strings for unavailable review fields", () => {
    const result = parseAtlassianReviewPage(REVIEW_JSON, 1, 0);
    // reviewerCountry and durationUsingApp are not available in the API
    expect(result.reviews[0].reviewerCountry).toBe("");
    expect(result.reviews[0].durationUsingApp).toBe("");
    expect(result.reviews[0].developerReplyDate).toBeNull();
    expect(result.reviews[0].developerReplyText).toBeNull();
  });

  it("handles review with missing date", () => {
    const noDateJson = {
      count: 1,
      _embedded: {
        reviews: [
          {
            stars: 4,
            review: "Good",
            _embedded: { author: { name: "Tester" } },
          },
        ],
      },
    };
    const result = parseAtlassianReviewPage(noDateJson, 1, 0);
    expect(result.reviews[0].reviewDate).toBe("");
  });
});
