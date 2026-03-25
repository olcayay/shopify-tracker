import * as cheerio from "cheerio";
import { createLogger } from "@appranks/shared";
import type { NormalizedReviewPage, NormalizedReview } from "../../platform-module.js";

const log = createLogger("hubspot:review-parser");

/**
 * Parse reviews from a HubSpot App Marketplace app detail page.
 *
 * Reviews are displayed on the app detail page itself (rendered via Playwright).
 */
export function parseHubSpotReviewPage(
  html: string,
  page: number,
): NormalizedReviewPage {
  const $ = cheerio.load(html);
  const reviews: NormalizedReview[] = [];

  // Look for review containers
  $("[class*='review'], [class*='Review'], [data-review]").each((_i, el) => {
    const reviewEl = $(el);

    // Skip containers that hold multiple reviews (parent wrappers)
    if (reviewEl.find("[class*='review'], [class*='Review']").length > 1) return;

    // Reviewer name
    const reviewerName = reviewEl.find(
      "[class*='reviewer'], [class*='author'], [class*='Reviewer'], [class*='Author'], [class*='user']"
    ).first().text().trim() || "Anonymous";

    // Rating
    const ratingText = reviewEl.find("[class*='rating'], [class*='stars'], [class*='Rating']").first().attr("data-rating")
      || reviewEl.find("[class*='rating'], [class*='stars']").first().text().trim();
    const ratingMatch = ratingText?.match(/([\d.]+)/);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
    if (rating === 0) return; // Not a review element

    // Content
    const content = reviewEl.find(
      "[class*='content'], [class*='body'], [class*='text'], [class*='Content'], [class*='Body'], p"
    ).first().text().trim() || "";

    // Date
    const dateText = reviewEl.find("[class*='date'], [class*='Date'], time").first().text().trim()
      || reviewEl.find("time").first().attr("datetime")
      || "";

    // Developer reply
    const replyEl = reviewEl.find("[class*='reply'], [class*='Reply'], [class*='response'], [class*='Response']").first();
    const developerReplyText = replyEl.text().trim() || null;
    const developerReplyDate = replyEl.find("time, [class*='date']").first().text().trim() || null;

    reviews.push({
      reviewDate: dateText,
      content,
      reviewerName,
      reviewerCountry: "",
      durationUsingApp: "",
      rating,
      developerReplyDate,
      developerReplyText,
    });
  });

  log.info("parsed reviews", { reviewsFound: reviews.length, page });

  return {
    reviews,
    hasNextPage: false, // Reviews are on the same page
    currentPage: page,
  };
}
