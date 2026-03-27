import * as cheerio from "cheerio";
import { createLogger, safeParseFloat } from "@appranks/shared";
import type { NormalizedReviewPage, NormalizedReview } from "../../platform-module.js";

const log = createLogger("zendesk:review-parser");

/**
 * Parse reviews from a Zendesk Marketplace app detail page.
 *
 * Reviews are displayed on the app detail page itself.
 * The page is rendered via Playwright (Cloudflare).
 */
export function parseZendeskReviewPage(
  html: string,
  page: number,
): NormalizedReviewPage {
  const $ = cheerio.load(html);
  const reviews: NormalizedReview[] = [];

  // Look for review containers — common patterns in marketplace pages
  $("[class*='review'], [class*='Review'], [data-review]").each((_i, el) => {
    const reviewEl = $(el);

    // Skip containers that are just review summaries/headers
    if (reviewEl.find("[class*='review'], [class*='Review']").length > 1) return;

    // Reviewer name
    const reviewerName = reviewEl.find("[class*='reviewer'], [class*='author'], [class*='Reviewer'], [class*='Author']").first().text().trim()
      || "Anonymous";

    // Rating
    const ratingText = reviewEl.find("[class*='rating'], [class*='stars'], [class*='Rating']").first().attr("data-rating")
      || reviewEl.find("[class*='rating'], [class*='stars']").first().text().trim();
    const ratingMatch = ratingText?.match(/([\d.]+)/);
    const rating = safeParseFloat(ratingMatch?.[1], 0)!;
    if (rating === 0) return; // Skip if no rating found (likely not a review element)

    // Review content
    const content = reviewEl.find("[class*='content'], [class*='body'], [class*='text'], [class*='Content'], [class*='Body'], p").first().text().trim()
      || "";

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
