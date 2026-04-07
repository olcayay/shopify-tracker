import { createLogger } from "@appranks/shared";
import type { NormalizedReviewPage, NormalizedReview } from "../../platform-module.js";

const log = createLogger("zendesk:review-parser");

/**
 * Parse reviews from the Zendesk Marketplace REST API v2 response.
 *
 * API endpoint: marketplace.zendesk.com/api/v2/apps/{numericId}/reviews.json
 * Returns: { reviews: [...], count, links: { next }, next_url }
 *
 * Each review object:
 *   id, app_id, rating (1-5), review (text), state, time_ago,
 *   created_at, updated_at, user_details?: { name, subdomain }
 */
export function parseZendeskReviewPage(
  json: string,
  page: number,
): NormalizedReviewPage {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    log.error("failed to parse review API response as JSON", { page });
    return { reviews: [], hasNextPage: false, currentPage: page };
  }

  const rawReviews = data.reviews || [];
  const reviews: NormalizedReview[] = [];

  for (const r of rawReviews) {
    if (!r || r.state !== "published") continue;

    const rating = Number(r.rating);
    if (!rating || rating < 1 || rating > 5) continue;

    reviews.push({
      reviewDate: r.created_at || "",
      content: r.review || "",
      reviewerName: r.user_details?.name || "Anonymous",
      reviewerCountry: "",
      durationUsingApp: "",
      rating,
      developerReplyDate: null,
      developerReplyText: null,
    });
  }

  const hasNextPage = !!data.next_url;

  log.info("parsed reviews from API", {
    reviewsFound: reviews.length,
    totalCount: data.count,
    page,
    hasNextPage,
  });

  return {
    reviews,
    hasNextPage,
    currentPage: page,
  };
}
