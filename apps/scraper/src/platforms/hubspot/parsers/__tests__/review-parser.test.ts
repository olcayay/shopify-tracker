import { describe, it, expect } from "vitest";
import { parseHubSpotReviewPage } from "../review-parser.js";
import { makeEcosystemReviewResponse } from "./fixtures.js";

describe("parseHubSpotReviewPage", () => {
  it("parses reviews from ecosystem API response", () => {
    const json = makeEcosystemReviewResponse();
    const result = parseHubSpotReviewPage(json, 1);

    expect(result.reviews).toHaveLength(3);
    expect(result.currentPage).toBe(1);
  });

  it("maps review fields correctly", () => {
    const json = makeEcosystemReviewResponse({
      reviews: [
        {
          id: 100,
          createdAt: 1706705331353, // 2024-01-31
          reviewerDisplayName: "Mueller, S.",
          overallRating: 5,
          title: "Great app",
          review: "Works perfectly",
          reply: { repliedAt: 1707000000000, reply: "Thanks!" },
        },
      ],
      total: 1,
    });

    const result = parseHubSpotReviewPage(json, 1);
    const review = result.reviews[0];

    expect(review.reviewDate).toBe("2024-01-31");
    expect(review.content).toBe("Great app — Works perfectly");
    expect(review.reviewerName).toBe("Mueller, S.");
    expect(review.rating).toBe(5);
    expect(review.developerReplyDate).toBe("2024-02-03");
    expect(review.developerReplyText).toBe("Thanks!");
    expect(review.reviewerCountry).toBe("");
    expect(review.durationUsingApp).toBe("");
  });

  it("handles review without title", () => {
    const json = makeEcosystemReviewResponse({
      reviews: [
        {
          id: 200,
          createdAt: 1700000000000,
          title: "",
          review: "Just the body",
        },
      ],
      total: 1,
    });

    const result = parseHubSpotReviewPage(json, 1);
    expect(result.reviews[0].content).toBe("Just the body");
  });

  it("handles review with title only", () => {
    const json = makeEcosystemReviewResponse({
      reviews: [
        {
          id: 300,
          createdAt: 1700000000000,
          title: "Only title here",
          review: "",
        },
      ],
      total: 1,
    });

    const result = parseHubSpotReviewPage(json, 1);
    expect(result.reviews[0].content).toBe("Only title here");
  });

  it("handles null developer reply", () => {
    const json = makeEcosystemReviewResponse({
      reviews: [
        {
          id: 400,
          createdAt: 1700000000000,
          reply: null,
        },
      ],
      total: 1,
    });

    const result = parseHubSpotReviewPage(json, 1);
    expect(result.reviews[0].developerReplyDate).toBeNull();
    expect(result.reviews[0].developerReplyText).toBeNull();
  });

  it("returns hasNextPage true when more reviews exist", () => {
    const json = makeEcosystemReviewResponse({ total: 250 });
    const result = parseHubSpotReviewPage(json, 1);
    // Default fixture has 3 reviews, total=250, offset=0 → 0+3 < 250
    expect(result.hasNextPage).toBe(true);
  });

  it("returns hasNextPage false on last page", () => {
    const json = makeEcosystemReviewResponse({ total: 3 });
    const result = parseHubSpotReviewPage(json, 1);
    // 3 reviews, total=3, offset=0 → 0+3 < 3 is false
    expect(result.hasNextPage).toBe(false);
  });

  it("calculates offset correctly for page 2", () => {
    // Page 2 means offset = 100 (page size). With 3 reviews and total=150:
    // offset(100) + 3 < 150 → true
    const json = makeEcosystemReviewResponse({ total: 150 });
    const result = parseHubSpotReviewPage(json, 2);
    expect(result.hasNextPage).toBe(true);
    expect(result.currentPage).toBe(2);
  });

  it("handles empty response", () => {
    const json = JSON.stringify({ reviews: [], total: 0 });
    const result = parseHubSpotReviewPage(json, 1);
    expect(result.reviews).toEqual([]);
    expect(result.hasNextPage).toBe(false);
    expect(result.currentPage).toBe(1);
  });

  it("handles invalid JSON gracefully", () => {
    const result = parseHubSpotReviewPage("not json", 1);
    expect(result.reviews).toEqual([]);
    expect(result.hasNextPage).toBe(false);
  });

  it("handles missing fields gracefully", () => {
    const json = JSON.stringify({
      reviews: [{ id: 500 }],
      total: 1,
    });

    const result = parseHubSpotReviewPage(json, 1);
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].reviewDate).toBe("");
    expect(result.reviews[0].content).toBe("");
    expect(result.reviews[0].reviewerName).toBe("");
    expect(result.reviews[0].rating).toBe(0);
  });
});
