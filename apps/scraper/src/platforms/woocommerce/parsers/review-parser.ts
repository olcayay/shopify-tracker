import type { NormalizedReviewPage } from "../../platform-module.js";

/**
 * Parse WooCommerce review data.
 *
 * The WooCommerce search API provides aggregate rating + reviews_count per product,
 * but individual reviews are only available on the HTML product page.
 * For now, this returns an empty reviews array. Aggregate stats are captured
 * in the app-parser via averageRating/ratingCount.
 */
export function parseWooCommerceReviewPage(
  _json: string,
  page: number,
): NormalizedReviewPage {
  return {
    reviews: [],
    hasNextPage: false,
    currentPage: page,
  };
}
