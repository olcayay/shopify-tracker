import { describe, it, expect } from "vitest";
import { parseZendeskReviewPage } from "../review-parser.js";

/**
 * Build a Zendesk Marketplace REST API v2 review response.
 * Mirrors the real API shape: { reviews, count, links, next_url }
 */
function makeReviewJson(
  reviews: Array<{
    id?: number;
    rating?: number;
    review?: string;
    state?: string;
    created_at?: string;
    userName?: string;
  }> = [],
  opts?: { nextUrl?: string; count?: number },
): string {
  const apiReviews = reviews.map((r, i) => ({
    id: r.id ?? 90000 + i,
    app_id: 976803,
    subject_id: 976803,
    subject_type: "App",
    rating: r.rating ?? 5,
    review: r.review ?? "",
    state: r.state ?? "published",
    time_ago: "3 months",
    created_at: r.created_at ?? "2025-11-24T00:46:32Z",
    updated_at: r.created_at ?? "2025-11-24T00:46:32Z",
    ...(r.userName ? { user_details: { name: r.userName, subdomain: "test.zendesk.com" } } : {}),
  }));

  return JSON.stringify({
    reviews: apiReviews,
    count: opts?.count ?? reviews.length,
    links: opts?.nextUrl ? { next: opts.nextUrl } : {},
    next_url: opts?.nextUrl ?? null,
  });
}

describe("parseZendeskReviewPage", () => {
  it("parses reviews from API JSON", () => {
    const json = makeReviewJson([
      { rating: 5, review: "Great app, works perfectly!", userName: "John Doe", created_at: "2024-01-15T10:00:00Z" },
      { rating: 3, review: "Decent but needs improvement.", userName: "Jane Smith", created_at: "2024-02-20T14:30:00Z" },
    ]);

    const result = parseZendeskReviewPage(json, 1);

    expect(result.reviews).toHaveLength(2);
    expect(result.hasNextPage).toBe(false);
    expect(result.currentPage).toBe(1);
  });

  it("parses review details correctly", () => {
    const json = makeReviewJson([
      { rating: 5, review: "Absolutely fantastic!", userName: "Alice", created_at: "2024-03-10T08:00:00Z" },
    ]);

    const result = parseZendeskReviewPage(json, 1);
    const r = result.reviews[0];

    expect(r.reviewerName).toBe("Alice");
    expect(r.rating).toBe(5);
    expect(r.content).toBe("Absolutely fantastic!");
    expect(r.reviewDate).toBe("2024-03-10T08:00:00Z");
    expect(r.reviewerCountry).toBe("");
    expect(r.durationUsingApp).toBe("");
    expect(r.developerReplyText).toBeNull();
    expect(r.developerReplyDate).toBeNull();
  });

  it("defaults reviewerName to Anonymous when no user_details", () => {
    const json = makeReviewJson([
      { rating: 4, review: "Nice app" },
    ]);

    const result = parseZendeskReviewPage(json, 1);
    expect(result.reviews[0].reviewerName).toBe("Anonymous");
  });

  it("skips reviews with invalid ratings", () => {
    const json = makeReviewJson([
      { rating: 0, review: "Bad rating" },
      { rating: 4, review: "Valid review", userName: "Valid" },
      { rating: 6, review: "Out of range" },
    ]);

    const result = parseZendeskReviewPage(json, 1);
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].reviewerName).toBe("Valid");
  });

  it("skips non-published reviews", () => {
    const json = makeReviewJson([
      { rating: 5, review: "Published", state: "published" },
      { rating: 5, review: "Pending", state: "pending" },
      { rating: 5, review: "Removed", state: "removed" },
    ]);

    const result = parseZendeskReviewPage(json, 1);
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].content).toBe("Published");
  });

  it("handles empty reviews array", () => {
    const json = makeReviewJson([]);
    const result = parseZendeskReviewPage(json, 1);

    expect(result.reviews).toHaveLength(0);
    expect(result.hasNextPage).toBe(false);
    expect(result.currentPage).toBe(1);
  });

  it("detects hasNextPage when next_url is present", () => {
    const json = makeReviewJson(
      [{ rating: 5, review: "Review 1" }],
      { nextUrl: "https://marketplace.zendesk.com/api/v2/apps/976803/reviews.json?since_id=123", count: 15 },
    );

    const result = parseZendeskReviewPage(json, 1);
    expect(result.hasNextPage).toBe(true);
  });

  it("sets hasNextPage to false when no next_url", () => {
    const json = makeReviewJson(
      [{ rating: 5, review: "Last page" }],
      { count: 1 },
    );

    const result = parseZendeskReviewPage(json, 1);
    expect(result.hasNextPage).toBe(false);
  });

  it("preserves the page number in currentPage", () => {
    const json = makeReviewJson([]);

    expect(parseZendeskReviewPage(json, 1).currentPage).toBe(1);
    expect(parseZendeskReviewPage(json, 3).currentPage).toBe(3);
  });

  it("handles invalid JSON gracefully", () => {
    const result = parseZendeskReviewPage("not-valid-json", 1);
    expect(result.reviews).toHaveLength(0);
    expect(result.hasNextPage).toBe(false);
  });

  it("handles API response with total count > returned reviews", () => {
    const json = makeReviewJson(
      [
        { rating: 5, review: "Review A" },
        { rating: 4, review: "Review B" },
      ],
      { count: 50, nextUrl: "https://marketplace.zendesk.com/api/v2/apps/976803/reviews.json?page=2" },
    );

    const result = parseZendeskReviewPage(json, 1);
    expect(result.reviews).toHaveLength(2);
    expect(result.hasNextPage).toBe(true);
  });
});
