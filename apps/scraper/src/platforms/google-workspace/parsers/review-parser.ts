import * as cheerio from "cheerio";
import { createLogger } from "@appranks/shared";
import type { NormalizedReviewPage, NormalizedReview } from "../../platform-module.js";
import { extractAfData, extractReviewEntries } from "./extract-embedded-data.js";

const log = createLogger("gworkspace-review-parser");

/**
 * Parse Google Workspace Marketplace review page.
 * Reviews are embedded on the app detail page.
 *
 * Primary data source: AF_initDataCallback ds:6 (structured review JSON)
 * Format: [appId, null, null, totalCount, [[review1], [review2], ...]]
 * Each review: [[[appId, authorId], rating, content, timestampMs, ?, null, [authorName, avatarUrl], ...]]
 *
 * Fallback: DOM selectors for review containers.
 */
export function parseGoogleWorkspaceReviewPage(
  html: string,
  page: number,
): NormalizedReviewPage {
  // Try structured JSON first
  const ds6 = extractAfData(html, "ds:6");
  const entries = extractReviewEntries(ds6);

  if (entries.length > 0) {
    log.info("parsed reviews from embedded JSON", { count: entries.length });
    const reviews: NormalizedReview[] = entries.map(entry => ({
      reviewDate: new Date(entry.timestampMs).toISOString().split("T")[0],
      content: entry.content,
      reviewerName: entry.authorName,
      reviewerCountry: "",
      durationUsingApp: "",
      rating: entry.rating,
      developerReplyDate: null,
      developerReplyText: null,
    }));

    return {
      reviews,
      hasNextPage: false,
      currentPage: page,
    };
  }

  // Fallback: DOM parsing
  log.warn("falling back to DOM parsing for reviews");
  return parseReviewsFromDom(html, page);
}

/**
 * Fallback DOM parser using real review selectors.
 *
 * Review container: div.ftijEf[data-app-id]
 *   div.iLLAJe — reviewer name
 *   div.b479ib[aria-label] — star rating (e.g., "User Rating: 5 stars")
 *   div.wzBhKb — date (e.g., "December 12, 2024")
 *   div.bR5MYb — review text body
 */
function parseReviewsFromDom(html: string, page: number): NormalizedReviewPage {
  const $ = cheerio.load(html);
  const reviews: NormalizedReview[] = [];

  $("div.ftijEf").each((_, el) => {
    const $review = $(el);

    const content = $review.find("div.bR5MYb").text().trim();
    if (!content) return;

    const reviewerName = $review.find("div.iLLAJe").text().trim() || "Anonymous";

    // Parse rating from aria-label: "User Rating: 5 stars"
    const ratingLabel = $review.find("div.b479ib").attr("aria-label") || "";
    const ratingMatch = ratingLabel.match(/(\d+)\s*star/i);
    const rating = ratingMatch ? parseInt(ratingMatch[1], 10) : 0;

    // Date text: "December 12, 2024"
    const dateText = $review.find("div.wzBhKb").text().trim();
    const reviewDate = parseDateText(dateText);

    reviews.push({
      reviewDate,
      content,
      reviewerName,
      reviewerCountry: "",
      durationUsingApp: "",
      rating,
      developerReplyDate: null,
      developerReplyText: null,
    });
  });

  log.info("parsed reviews from DOM", { count: reviews.length });

  return {
    reviews,
    hasNextPage: false,
    currentPage: page,
  };
}

/**
 * Parse a human-readable date like "December 12, 2024" to ISO format "2024-12-12".
 */
function parseDateText(text: string): string {
  if (!text) return "";
  try {
    const date = new Date(text);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  } catch {}
  return text;
}
