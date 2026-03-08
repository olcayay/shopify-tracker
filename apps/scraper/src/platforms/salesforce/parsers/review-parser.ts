import type { NormalizedReviewPage, NormalizedReview } from "../../platform-module.js";

interface SalesforceReviewResponse {
  totalReviewCount: number;
  hasNext: boolean;
  reviews: SalesforceReview[];
}

interface SalesforceReview {
  id: string;
  rating: number;
  reviewDate: string;
  user: { name: string };
  questionResponses: {
    questionName: string;
    response: string;
  }[];
  comments?: {
    commentDate: string;
    body: string;
  }[];
}

/**
 * Parse Salesforce AppExchange reviews API JSON response.
 * API: GET /services/apexrest/reviews?listingId={id}&pageNumber={page}
 */
export function parseSalesforceReviewPage(
  json: string,
  page: number
): NormalizedReviewPage {
  const data: SalesforceReviewResponse = JSON.parse(json);

  const reviews: NormalizedReview[] = (data.reviews || []).map((r) => {
    // Extract title and comments from questionResponses
    let title = "";
    let comments = "";
    for (const qr of r.questionResponses || []) {
      if (qr.questionName === "Title") title = qr.response || "";
      if (qr.questionName === "Comments") comments = qr.response || "";
    }

    const content = title && comments ? `${title}\n\n${comments}` : comments || title;

    // Developer reply from comments[0]
    const reply = r.comments?.[0];

    return {
      reviewDate: r.reviewDate ? r.reviewDate.slice(0, 10) : "",
      content,
      reviewerName: r.user?.name || "",
      reviewerCountry: "",
      durationUsingApp: "",
      rating: r.rating,
      developerReplyDate: reply?.commentDate ? reply.commentDate.slice(0, 10) : null,
      developerReplyText: reply?.body || null,
    };
  });

  return {
    reviews,
    hasNextPage: data.hasNext ?? false,
    currentPage: page,
  };
}
