import { describe, it, expect } from "vitest";
import { parseSalesforceReviewPage } from "../review-parser.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeReviewJson(overrides: {
  totalReviewCount?: number;
  hasNext?: boolean;
  reviews?: any[];
} = {}): string {
  return JSON.stringify({
    totalReviewCount: overrides.totalReviewCount ?? 42,
    hasNext: overrides.hasNext ?? false,
    reviews: overrides.reviews ?? [
      {
        id: "rev-001",
        rating: 5,
        reviewDate: "2025-12-15T10:30:00Z",
        user: { name: "Alice Johnson" },
        questionResponses: [
          { questionName: "Title", response: "Excellent integration" },
          { questionName: "Comments", response: "Works seamlessly with our Salesforce org." },
        ],
        comments: [
          { commentDate: "2025-12-20T14:00:00Z", body: "Thank you for the feedback!" },
        ],
      },
      {
        id: "rev-002",
        rating: 3,
        reviewDate: "2025-11-05T09:00:00Z",
        user: { name: "Bob Smith" },
        questionResponses: [
          { questionName: "Title", response: "" },
          { questionName: "Comments", response: "Decent but needs more configuration." },
        ],
        comments: [],
      },
      {
        id: "rev-003",
        rating: 1,
        reviewDate: "2025-10-01T18:45:00Z",
        user: { name: "Charlie Dev" },
        questionResponses: [
          { questionName: "Title", response: "Does not work" },
          { questionName: "Comments", response: "" },
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseSalesforceReviewPage", () => {
  it("parses reviews from API JSON response", () => {
    const json = makeReviewJson();
    const result = parseSalesforceReviewPage(json, 1);
    expect(result.reviews).toHaveLength(3);
    expect(result.currentPage).toBe(1);
  });

  it("extracts rating from review", () => {
    const json = makeReviewJson();
    const result = parseSalesforceReviewPage(json, 1);
    expect(result.reviews[0].rating).toBe(5);
    expect(result.reviews[1].rating).toBe(3);
    expect(result.reviews[2].rating).toBe(1);
  });

  it("combines title and comments with double newline", () => {
    const json = makeReviewJson();
    const result = parseSalesforceReviewPage(json, 1);
    expect(result.reviews[0].content).toBe("Excellent integration\n\nWorks seamlessly with our Salesforce org.");
  });

  it("uses only comments when title is empty", () => {
    const json = makeReviewJson();
    const result = parseSalesforceReviewPage(json, 1);
    expect(result.reviews[1].content).toBe("Decent but needs more configuration.");
  });

  it("uses only title when comments is empty", () => {
    const json = makeReviewJson();
    const result = parseSalesforceReviewPage(json, 1);
    expect(result.reviews[2].content).toBe("Does not work");
  });

  it("converts ISO date to YYYY-MM-DD format", () => {
    const json = makeReviewJson();
    const result = parseSalesforceReviewPage(json, 1);
    expect(result.reviews[0].reviewDate).toBe("2025-12-15");
    expect(result.reviews[1].reviewDate).toBe("2025-11-05");
  });

  it("extracts reviewer name from user.name", () => {
    const json = makeReviewJson();
    const result = parseSalesforceReviewPage(json, 1);
    expect(result.reviews[0].reviewerName).toBe("Alice Johnson");
    expect(result.reviews[1].reviewerName).toBe("Bob Smith");
  });

  it("extracts developer reply from comments[0]", () => {
    const json = makeReviewJson();
    const result = parseSalesforceReviewPage(json, 1);
    expect(result.reviews[0].developerReplyDate).toBe("2025-12-20");
    expect(result.reviews[0].developerReplyText).toBe("Thank you for the feedback!");
  });

  it("sets null developer reply when no comments", () => {
    const json = makeReviewJson();
    const result = parseSalesforceReviewPage(json, 1);
    expect(result.reviews[1].developerReplyDate).toBeNull();
    expect(result.reviews[1].developerReplyText).toBeNull();
  });

  it("sets null developer reply when comments array is undefined", () => {
    const json = makeReviewJson();
    const result = parseSalesforceReviewPage(json, 1);
    expect(result.reviews[2].developerReplyDate).toBeNull();
    expect(result.reviews[2].developerReplyText).toBeNull();
  });

  it("determines hasNextPage from response", () => {
    const json = makeReviewJson({ hasNext: true });
    const result = parseSalesforceReviewPage(json, 1);
    expect(result.hasNextPage).toBe(true);
  });

  it("returns hasNextPage false when no more pages", () => {
    const json = makeReviewJson({ hasNext: false });
    const result = parseSalesforceReviewPage(json, 2);
    expect(result.hasNextPage).toBe(false);
    expect(result.currentPage).toBe(2);
  });

  it("handles empty reviews array", () => {
    const json = makeReviewJson({ reviews: [], totalReviewCount: 0 });
    const result = parseSalesforceReviewPage(json, 1);
    expect(result.reviews).toEqual([]);
    expect(result.hasNextPage).toBe(false);
  });

  it("handles missing questionResponses", () => {
    const json = JSON.stringify({
      totalReviewCount: 1,
      hasNext: false,
      reviews: [
        {
          id: "rev-missing",
          rating: 4,
          reviewDate: "2025-08-01T00:00:00Z",
          user: { name: "Tester" },
          questionResponses: [],
        },
      ],
    });
    const result = parseSalesforceReviewPage(json, 1);
    expect(result.reviews[0].content).toBe("");
    expect(result.reviews[0].rating).toBe(4);
  });

  it("handles missing user field", () => {
    const json = JSON.stringify({
      totalReviewCount: 1,
      hasNext: false,
      reviews: [
        {
          id: "rev-nouser",
          rating: 2,
          reviewDate: "2025-07-01T00:00:00Z",
          user: {},
          questionResponses: [],
        },
      ],
    });
    const result = parseSalesforceReviewPage(json, 1);
    expect(result.reviews[0].reviewerName).toBe("");
  });

  it("sets empty strings for reviewerCountry and durationUsingApp", () => {
    const json = makeReviewJson();
    const result = parseSalesforceReviewPage(json, 1);
    expect(result.reviews[0].reviewerCountry).toBe("");
    expect(result.reviews[0].durationUsingApp).toBe("");
  });

  it("handles missing reviewDate", () => {
    const json = JSON.stringify({
      totalReviewCount: 1,
      hasNext: false,
      reviews: [
        {
          id: "rev-nodate",
          rating: 3,
          user: { name: "No Date" },
          questionResponses: [],
        },
      ],
    });
    const result = parseSalesforceReviewPage(json, 1);
    expect(result.reviews[0].reviewDate).toBe("");
  });
});
