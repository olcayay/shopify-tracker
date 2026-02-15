import * as cheerio from "cheerio";
import { createLogger, type ReviewPageData, type Review } from "@shopify-tracking/shared";

const log = createLogger("review-parser");

/**
 * Parse a reviews page (/app-slug/reviews?page=N).
 * Uses [data-merchant-review] elements for each review block.
 */
export function parseReviewPage(
  html: string,
  currentPage: number
): ReviewPageData {
  const $ = cheerio.load(html);

  const reviews: Review[] = [];

  const reviewElements = $("[data-merchant-review]");

  if (reviewElements.length === 0 && currentPage === 1) {
    log.warn("no [data-merchant-review] elements found — possible HTML structure change");
  }

  reviewElements.each((_, el) => {
    try {
      const $review = $(el);

      // Rating from aria-label="X out of 5 stars"
      const ariaLabel = $review.find("[aria-label]").first().attr("aria-label") || "";
      const ratingMatch = ariaLabel.match(/(\d)\s*out of 5 stars/);
      const rating = ratingMatch ? parseInt(ratingMatch[1], 10) : 0;
      if (rating < 1 || rating > 5) return;

      // Date — small text like "October 20, 2025"
      let reviewDate = "";
      $review.find(".tw-text-body-xs").each((_, dateEl) => {
        const t = $(dateEl).text().trim();
        const m = t.match(
          /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})\b/
        );
        if (m && !reviewDate) reviewDate = m[1];
      });
      if (!reviewDate) return;

      // Content — inside [data-truncate-content-copy] p
      const content =
        $review.find("[data-truncate-content-copy] p").text().trim() ||
        $review.find("[data-truncate-review] p").text().trim();

      // Reviewer name — span with title inside .tw-text-heading-xs
      const reviewerName =
        $review.find(".tw-text-heading-xs span[title]").attr("title")?.trim() ||
        $review.find(".tw-text-heading-xs span").first().text().trim() ||
        "";

      // Reviewer info (country, duration) — sibling divs after reviewer name
      let reviewerCountry = "";
      let durationUsingApp = "";

      const infoSection = $review.find(".tw-text-heading-xs").parent();
      infoSection.find("div").each((_, div) => {
        const t = $(div).text().trim();
        if ($(div).hasClass("tw-text-heading-xs")) return;
        if (/using the app/i.test(t)) {
          durationUsingApp = t;
        } else if (
          t.length > 1 &&
          t.length < 80 &&
          !t.includes("stars") &&
          !reviewerCountry
        ) {
          reviewerCountry = t;
        }
      });

      // Developer reply
      let developerReplyDate: string | null = null;
      let developerReplyText: string | null = null;

      const replySection = $review.find("[data-merchant-review-reply]");
      const replyContent = replySection.text().trim();
      if (replyContent.length > 0) {
        const replyDateMatch = replyContent.match(
          /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})\b/
        );
        developerReplyDate = replyDateMatch ? replyDateMatch[1] : null;
        developerReplyText = replySection.find("p").text().trim() || null;
      }

      reviews.push({
        review_date: reviewDate,
        content,
        reviewer_name: reviewerName,
        reviewer_country: reviewerCountry,
        duration_using_app: durationUsingApp,
        rating,
        developer_reply_date: developerReplyDate,
        developer_reply_text: developerReplyText,
      });
    } catch (e) {
      log.warn("failed to parse individual review element", { page: currentPage, error: String(e) });
    }
  });

  // Pagination
  const hasNext =
    $('a[rel="next"]').length > 0 ||
    $(`a[href*="page=${currentPage + 1}"]`).length > 0;

  return {
    reviews,
    has_next_page: hasNext,
    current_page: currentPage,
  };
}
