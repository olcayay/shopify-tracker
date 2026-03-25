import { describe, it, expect } from "vitest";
import { parseHubSpotReviewPage } from "../review-parser.js";
import { makeReviewHtml } from "./fixtures.js";

describe("parseHubSpotReviewPage", () => {
  it("parses reviews from review-item elements", () => {
    const html = makeReviewHtml();
    const result = parseHubSpotReviewPage(html, 1);

    expect(result.reviews).toHaveLength(3);
    expect(result.currentPage).toBe(1);
    expect(result.hasNextPage).toBe(false);
  });

  it("parses reviewer name", () => {
    const html = makeReviewHtml({
      reviews: [{ author: "Alice Johnson", rating: "5", content: "Great!" }],
    });
    const result = parseHubSpotReviewPage(html, 1);

    expect(result.reviews[0].reviewerName).toBe("Alice Johnson");
  });

  it("parses rating from data-rating attribute", () => {
    const html = makeReviewHtml({
      reviews: [{ rating: "4.5", content: "Good", author: "Bob" }],
    });
    const result = parseHubSpotReviewPage(html, 1);

    expect(result.reviews[0].rating).toBe(4.5);
  });

  it("parses review content", () => {
    const html = makeReviewHtml({
      reviews: [{ rating: "5", content: "This is an amazing integration!", author: "Jane" }],
    });
    const result = parseHubSpotReviewPage(html, 1);

    expect(result.reviews[0].content).toBe("This is an amazing integration!");
  });

  it("parses review date", () => {
    const html = makeReviewHtml({
      reviews: [{ rating: "4", content: "Nice", date: "2025-06-15", author: "Tom" }],
    });
    const result = parseHubSpotReviewPage(html, 1);

    expect(result.reviews[0].reviewDate).toBe("2025-06-15");
  });

  it("parses developer reply", () => {
    const html = makeReviewHtml({
      reviews: [{
        author: "Reviewer",
        rating: "3",
        content: "Needs improvement",
        replyText: "Thanks for the feedback, we are working on it!",
        replyDate: "2025-07-01",
      }],
    });
    const result = parseHubSpotReviewPage(html, 1);

    expect(result.reviews[0].developerReplyText).toContain("Thanks for the feedback, we are working on it!");
    expect(result.reviews[0].developerReplyDate).toBe("2025-07-01");
  });

  it("returns null for developer reply when not present", () => {
    const html = makeReviewHtml({
      reviews: [{ author: "Simple", rating: "5", content: "Love it" }],
    });
    const result = parseHubSpotReviewPage(html, 1);

    expect(result.reviews[0].developerReplyText).toBeNull();
    expect(result.reviews[0].developerReplyDate).toBeNull();
  });

  it("defaults reviewer name to Anonymous", () => {
    const html = `<html><body>
      <div class="review-item">
        <span class="rating" data-rating="4">4 stars</span>
        <div class="content">Good app</div>
      </div>
    </body></html>`;
    const result = parseHubSpotReviewPage(html, 1);

    expect(result.reviews[0].reviewerName).toBe("Anonymous");
  });

  it("skips review elements with zero rating", () => {
    const html = makeReviewHtml({
      reviews: [
        { author: "Real", rating: "5", content: "Real review" },
        { author: "Fake", rating: "0", content: "Not a review" },
      ],
    });
    const result = parseHubSpotReviewPage(html, 1);

    // Only the real review (rating > 0) should be included
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].reviewerName).toBe("Real");
  });

  it("sets empty strings for country and durationUsingApp", () => {
    const html = makeReviewHtml({
      reviews: [{ author: "Test", rating: "4", content: "Test" }],
    });
    const result = parseHubSpotReviewPage(html, 1);

    expect(result.reviews[0].reviewerCountry).toBe("");
    expect(result.reviews[0].durationUsingApp).toBe("");
  });

  it("always returns hasNextPage false (reviews on same page)", () => {
    const html = makeReviewHtml();
    const result = parseHubSpotReviewPage(html, 2);

    expect(result.hasNextPage).toBe(false);
    expect(result.currentPage).toBe(2);
  });

  it("handles page with no reviews", () => {
    const html = "<html><body><div>No reviews yet</div></body></html>";
    const result = parseHubSpotReviewPage(html, 1);

    expect(result.reviews).toEqual([]);
    expect(result.hasNextPage).toBe(false);
  });
});
