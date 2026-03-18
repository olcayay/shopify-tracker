import { createLogger } from "@appranks/shared";
import type { NormalizedReview, NormalizedReviewPage } from "../../platform-module.js";

const log = createLogger("atlassian:review-parser");

/**
 * Parse reviews from the Atlassian REST API JSON response.
 * Source: GET /rest/2/addons/{addonKey}/reviews?offset=N&limit=50
 */
export function parseAtlassianReviewPage(
  json: Record<string, any>,
  page: number,
  offset: number,
): NormalizedReviewPage {
  const embedded = json._embedded || {};
  const rawReviews = embedded.reviews || [];

  const reviews: NormalizedReview[] = rawReviews.map((r: Record<string, any>) => {
    const author = r._embedded?.author || {};

    // Convert ISO date to YYYY-MM-DD
    let reviewDate = "";
    if (r.date) {
      try {
        reviewDate = new Date(r.date).toISOString().split("T")[0];
      } catch {
        reviewDate = r.date;
      }
    }

    return {
      rating: r.stars ?? 0,
      content: r.review || r.body || "",
      reviewDate,
      reviewerName: author.name || author.displayName || "Anonymous",
      reviewerCountry: "",    // Not available in API
      durationUsingApp: "",   // Not available in API
      developerReplyDate: null,
      developerReplyText: null,
    };
  });

  const totalCount = json.count ?? 0;
  const hasNextPage = (offset + rawReviews.length) < totalCount;

  log.info("parsed review page", {
    page,
    reviewCount: reviews.length,
    totalCount,
    hasNextPage,
  });

  return {
    reviews,
    hasNextPage,
    currentPage: page,
  };
}
