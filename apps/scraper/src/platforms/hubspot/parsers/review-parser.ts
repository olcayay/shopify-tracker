import { createLogger } from "@appranks/shared";
import type { NormalizedReview, NormalizedReviewPage } from "../../platform-module.js";

const log = createLogger("hubspot:review-parser");

const REVIEW_PAGE_SIZE = 100;

interface EcosystemReview {
  id: number;
  createdAt: number;
  reviewerDisplayName?: string;
  companyName?: string;
  ratings?: { OVERALL?: number };
  answers?: { TITLE?: string; REVIEW?: string; PROS?: string; CONS?: string };
  reply?: { repliedAt?: number; reply?: string } | null;
  replies?: Array<{ repliedAt?: number; reply?: string }>;
}

interface EcosystemReviewResponse {
  reviews: EcosystemReview[];
  total: number;
}

/**
 * Parse reviews from HubSpot Ecosystem public API response.
 * Input: JSON string from POST /api/ecosystem/public/v1/reviews/search
 */
export function parseHubSpotReviewPage(
  json: string,
  page: number,
): NormalizedReviewPage {
  let data: EcosystemReviewResponse;
  try {
    data = JSON.parse(json);
  } catch {
    log.warn("failed to parse review JSON", { page });
    return { reviews: [], hasNextPage: false, currentPage: page };
  }

  const rawReviews = Array.isArray(data.reviews) ? data.reviews : [];
  const total = typeof data.total === "number" ? data.total : 0;

  const reviews: NormalizedReview[] = rawReviews.map((r) => {
    const title = r.answers?.TITLE ?? "";
    const body = r.answers?.REVIEW ?? "";
    const content = title && body ? `${title} — ${body}` : title || body;

    // Developer reply: check `reply` object first, then `replies` array
    const devReply = r.reply ?? (r.replies?.length ? r.replies[0] : null);

    return {
      reviewDate: r.createdAt ? formatDate(r.createdAt) : "",
      content,
      reviewerName: r.reviewerDisplayName ?? "",
      reviewerCountry: "",
      durationUsingApp: "",
      rating: r.ratings?.OVERALL ?? 0,
      developerReplyDate: devReply?.repliedAt ? formatDate(devReply.repliedAt) : null,
      developerReplyText: devReply?.reply ?? null,
    };
  });

  const offset = (page - 1) * REVIEW_PAGE_SIZE;
  const hasNextPage = offset + rawReviews.length < total;

  log.info("parsed reviews from ecosystem API", {
    page,
    count: reviews.length,
    total,
    hasNextPage,
  });

  return { reviews, hasNextPage, currentPage: page };
}

function formatDate(timestampMs: number): string {
  return new Date(timestampMs).toISOString().split("T")[0];
}
