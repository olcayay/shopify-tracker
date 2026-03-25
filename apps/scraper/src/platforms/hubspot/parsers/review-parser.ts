import { createLogger } from "@appranks/shared";
import type { NormalizedReviewPage } from "../../platform-module.js";

const log = createLogger("hubspot:review-parser");

/**
 * Parse reviews from CHIRP API response.
 *
 * The HubSpot CHIRP API does not expose review data publicly.
 * This parser returns empty results.
 */
export function parseHubSpotReviewPage(
  _json: string,
  page: number,
): NormalizedReviewPage {
  log.info("review data not available via CHIRP API", { page });
  return {
    reviews: [],
    hasNextPage: false,
    currentPage: page,
  };
}
