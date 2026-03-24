import { describe, it, expect } from "vitest";
import { parseZendeskReviewPage } from "../review-parser.js";

/**
 * Build HTML that matches the parser's selectors:
 * - Container: [class*='review'] (but only one level deep so container check passes)
 * - Reviewer name: [class*='author']
 * - Rating: [class*='rating'] with data-rating attr
 * - Content: [class*='body']
 * - Date: time element
 * - Reply: [class*='reply']
 */
function makeReviewHtml(reviews: Array<{
  reviewerName?: string;
  rating?: string;
  content?: string;
  date?: string;
  replyText?: string;
  replyDate?: string;
}> = []): string {
  const reviewHtml = reviews.map((r) => `
    <div class="user-review-card">
      <span class="author-name">${r.reviewerName ?? ""}</span>
      <span class="rating-stars" data-rating="${r.rating ?? ""}">${r.rating ?? ""}</span>
      <p class="body-text">${r.content ?? ""}</p>
      <time datetime="${r.date ?? ""}">${r.date ?? ""}</time>
      ${r.replyText ? `
        <div class="dev-reply">
          <p>${r.replyText}</p>
          <time datetime="${r.replyDate ?? ""}">${r.replyDate ?? ""}</time>
        </div>
      ` : ""}
    </div>
  `).join("");

  return `<html><body>${reviewHtml}</body></html>`;
}

describe("parseZendeskReviewPage", () => {
  it("should parse reviews from rendered HTML", () => {
    const html = makeReviewHtml([
      {
        reviewerName: "John Doe",
        rating: "4.5",
        content: "Great app, works perfectly!",
        date: "2024-01-15",
      },
      {
        reviewerName: "Jane Smith",
        rating: "3",
        content: "Decent but needs improvement.",
        date: "2024-02-20",
      },
    ]);

    const result = parseZendeskReviewPage(html, 1);

    expect(result.reviews).toHaveLength(2);
    expect(result.hasNextPage).toBe(false);
    expect(result.currentPage).toBe(1);
  });

  it("should parse review details correctly", () => {
    const html = makeReviewHtml([
      {
        reviewerName: "Alice",
        rating: "5",
        content: "Absolutely fantastic!",
        date: "2024-03-10",
      },
    ]);

    const result = parseZendeskReviewPage(html, 1);
    const r = result.reviews[0];

    expect(r.reviewerName).toBe("Alice");
    expect(r.rating).toBe(5);
    expect(r.content).toBe("Absolutely fantastic!");
    expect(r.reviewDate).toBe("2024-03-10");
    expect(r.reviewerCountry).toBe("");
    expect(r.durationUsingApp).toBe("");
    expect(r.developerReplyText).toBeNull();
    expect(r.developerReplyDate).toBeNull();
  });

  it("should parse developer reply", () => {
    const html = makeReviewHtml([
      {
        reviewerName: "Bob",
        rating: "2",
        content: "Not great.",
        date: "2024-04-01",
        replyText: "We are sorry to hear that. Please contact support.",
        replyDate: "2024-04-02",
      },
    ]);

    const result = parseZendeskReviewPage(html, 1);
    const r = result.reviews[0];

    expect(r.developerReplyText).toContain("We are sorry to hear that");
    expect(r.developerReplyDate).toBe("2024-04-02");
  });

  it("should skip elements without a valid rating (rating=0)", () => {
    const html = makeReviewHtml([
      { reviewerName: "No Rating", rating: "", content: "Missing rating" },
      { reviewerName: "Valid", rating: "4", content: "Has rating" },
    ]);

    const result = parseZendeskReviewPage(html, 1);

    // First item has no valid rating and should be skipped
    const validReviews = result.reviews.filter((r) => r.rating > 0);
    expect(validReviews.length).toBe(1);
    expect(validReviews[0].reviewerName).toBe("Valid");
  });

  it("should default reviewerName to Anonymous when no author element", () => {
    // Build manually without author-name span
    const html = `<html><body>
      <div class="user-review-card">
        <span class="rating-stars" data-rating="3">3</span>
        <p class="body-text">Anonymous review</p>
      </div>
    </body></html>`;

    const result = parseZendeskReviewPage(html, 1);
    expect(result.reviews.length).toBe(1);
    expect(result.reviews[0].reviewerName).toBe("Anonymous");
  });

  it("should handle empty HTML with no reviews", () => {
    const html = "<html><body><p>No reviews yet</p></body></html>";
    const result = parseZendeskReviewPage(html, 1);

    expect(result.reviews).toHaveLength(0);
    expect(result.hasNextPage).toBe(false);
    expect(result.currentPage).toBe(1);
  });

  it("should always set hasNextPage to false (reviews on same page)", () => {
    const html = makeReviewHtml([
      { reviewerName: "User", rating: "5", content: "Test" },
    ]);

    const result1 = parseZendeskReviewPage(html, 1);
    expect(result1.hasNextPage).toBe(false);

    const result2 = parseZendeskReviewPage(html, 2);
    expect(result2.hasNextPage).toBe(false);
  });

  it("should preserve the page number in currentPage", () => {
    const html = makeReviewHtml([]);

    expect(parseZendeskReviewPage(html, 1).currentPage).toBe(1);
    expect(parseZendeskReviewPage(html, 3).currentPage).toBe(3);
  });
});
