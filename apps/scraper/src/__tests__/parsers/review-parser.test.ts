import { describe, it, expect } from "vitest";
import { parseReviewPage } from "../../parsers/review-parser.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapHtml(body: string): string {
  return `<html><head></head><body>${body}</body></html>`;
}

function reviewHtml(opts: {
  rating: number;
  date: string;
  content: string;
  reviewerName: string;
  reviewerCountry?: string;
  durationUsingApp?: string;
  replyDate?: string;
  replyText?: string;
  archived?: boolean;
}): string {
  const ariaLabel = `${opts.rating} out of 5 stars`;
  const replySection = opts.replyDate
    ? `
      <div data-merchant-review-reply>
        <span class="tw-text-body-xs">${opts.replyDate}</span>
        <p>${opts.replyText ?? ""}</p>
      </div>`
    : "";

  const countryDiv = opts.reviewerCountry
    ? `<div>${opts.reviewerCountry}</div>`
    : "";
  const durationDiv = opts.durationUsingApp
    ? `<div>${opts.durationUsingApp}</div>`
    : "";

  const reviewEl = `
    <div data-merchant-review>
      <div aria-label="${ariaLabel}"></div>
      <span class="tw-text-body-xs">${opts.date}</span>
      <div>
        <div class="tw-text-heading-xs">
          <span title="${opts.reviewerName}">${opts.reviewerName}</span>
        </div>
        ${countryDiv}
        ${durationDiv}
      </div>
      ${replySection}
      <div data-truncate-content-copy>
        <p>${opts.content}</p>
      </div>
    </div>
  `;

  if (opts.archived) {
    return `<div id="archived-reviews-container">${reviewEl}</div>`;
  }
  return reviewEl;
}

// ---------------------------------------------------------------------------
// parseReviewPage
// ---------------------------------------------------------------------------

describe("parseReviewPage", () => {
  it("returns empty reviews for page with no review elements", () => {
    const html = wrapHtml("<p>No reviews yet</p>");
    const result = parseReviewPage(html, 1);
    expect(result.reviews).toEqual([]);
    expect(result.current_page).toBe(1);
    expect(result.has_next_page).toBe(false);
  });

  it("parses review with rating, date, content, reviewer name", () => {
    const html = wrapHtml(
      reviewHtml({
        rating: 5,
        date: "October 20, 2025",
        content: "This app is amazing and works perfectly!",
        reviewerName: "John's Store",
      })
    );
    const result = parseReviewPage(html, 1);
    expect(result.reviews).toHaveLength(1);

    const review = result.reviews[0];
    expect(review.rating).toBe(5);
    expect(review.review_date).toBe("October 20, 2025");
    expect(review.content).toContain("This app is amazing");
    expect(review.reviewer_name).toBe("John's Store");
  });

  it("skips reviews with invalid rating (0)", () => {
    const html = wrapHtml(
      reviewHtml({
        rating: 0,
        date: "January 5, 2025",
        content: "Invalid rating review",
        reviewerName: "Bad Review Store",
      })
    );
    const result = parseReviewPage(html, 1);
    expect(result.reviews).toEqual([]);
  });

  it("skips reviews with invalid rating (>5)", () => {
    const html = wrapHtml(
      reviewHtml({
        rating: 6,
        date: "January 5, 2025",
        content: "Too high rating",
        reviewerName: "Over Rated Store",
      })
    );
    const result = parseReviewPage(html, 1);
    expect(result.reviews).toEqual([]);
  });

  it("parses developer reply date and text", () => {
    const html = wrapHtml(
      reviewHtml({
        rating: 4,
        date: "March 10, 2025",
        content: "Good app but could improve.",
        reviewerName: "User Store",
        replyDate: "March 12, 2025",
        replyText: "Thank you for the feedback! We will improve soon.",
      })
    );
    const result = parseReviewPage(html, 1);
    const review = result.reviews[0];
    expect(review.developer_reply_date).toBe("March 12, 2025");
    expect(review.developer_reply_text).toBe("Thank you for the feedback! We will improve soon.");
  });

  it("sets null for developer reply when none present", () => {
    const html = wrapHtml(
      reviewHtml({
        rating: 3,
        date: "February 15, 2025",
        content: "Decent app but missing features.",
        reviewerName: "No Reply Store",
      })
    );
    const result = parseReviewPage(html, 1);
    expect(result.reviews[0].developer_reply_date).toBeNull();
    expect(result.reviews[0].developer_reply_text).toBeNull();
  });

  it("detects pagination from a[rel='next']", () => {
    const html = wrapHtml(`
      ${reviewHtml({
        rating: 5,
        date: "June 1, 2025",
        content: "Great experience with this app overall!",
        reviewerName: "Happy Store",
      })}
      <a rel="next" href="?page=2">Next</a>
    `);
    const result = parseReviewPage(html, 1);
    expect(result.has_next_page).toBe(true);
  });

  it("detects pagination from page=N+1 link", () => {
    const html = wrapHtml(`
      ${reviewHtml({
        rating: 4,
        date: "June 1, 2025",
        content: "Good app with room for improvement!",
        reviewerName: "Moderate Store",
      })}
      <a href="?page=4">4</a>
    `);
    const result = parseReviewPage(html, 3);
    expect(result.has_next_page).toBe(true);
  });

  it("returns false for has_next_page when no pagination links", () => {
    const html = wrapHtml(
      reviewHtml({
        rating: 5,
        date: "June 1, 2025",
        content: "Wonderful customer support experience!",
        reviewerName: "Last Page Store",
      })
    );
    const result = parseReviewPage(html, 2);
    expect(result.has_next_page).toBe(false);
  });

  it("skips archived reviews (#archived-reviews-container)", () => {
    const html = wrapHtml(`
      ${reviewHtml({
        rating: 5,
        date: "May 1, 2025",
        content: "Active review that should be parsed!",
        reviewerName: "Active Store",
      })}
      ${reviewHtml({
        rating: 1,
        date: "January 1, 2024",
        content: "This archived review should be skipped entirely.",
        reviewerName: "Archived Store",
        archived: true,
      })}
    `);
    const result = parseReviewPage(html, 1);
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].reviewer_name).toBe("Active Store");
  });

  it("sets current_page from argument", () => {
    const html = wrapHtml("<p>No reviews</p>");
    const result = parseReviewPage(html, 7);
    expect(result.current_page).toBe(7);
  });

  it("parses multiple reviews on one page", () => {
    const html = wrapHtml(`
      ${reviewHtml({
        rating: 5,
        date: "April 1, 2025",
        content: "First review with five star rating!",
        reviewerName: "Store A",
      })}
      ${reviewHtml({
        rating: 3,
        date: "April 2, 2025",
        content: "Second review with three star rating!",
        reviewerName: "Store B",
      })}
      ${reviewHtml({
        rating: 1,
        date: "April 3, 2025",
        content: "Third review with only one star rating!",
        reviewerName: "Store C",
      })}
    `);
    const result = parseReviewPage(html, 1);
    expect(result.reviews).toHaveLength(3);
    expect(result.reviews[0].rating).toBe(5);
    expect(result.reviews[1].rating).toBe(3);
    expect(result.reviews[2].rating).toBe(1);
  });

  it("parses reviewer country and duration using app", () => {
    const html = wrapHtml(
      reviewHtml({
        rating: 4,
        date: "July 15, 2025",
        content: "Solid app that does what it promises!",
        reviewerName: "International Store",
        reviewerCountry: "United States",
        durationUsingApp: "About 2 months using the app",
      })
    );
    const result = parseReviewPage(html, 1);
    expect(result.reviews[0].reviewer_country).toBe("United States");
    expect(result.reviews[0].duration_using_app).toBe("About 2 months using the app");
  });
});
