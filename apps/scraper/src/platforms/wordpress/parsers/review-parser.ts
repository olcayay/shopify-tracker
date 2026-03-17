import * as cheerio from "cheerio";
import { createLogger } from "@appranks/shared";
import type { NormalizedReview, NormalizedReviewPage } from "../../platform-module.js";

const log = createLogger("wordpress:review-parser");

/** Parse WordPress.org plugin reviews HTML page.
 *
 * The review listing uses BBPress forum markup.  Each review is a
 * `<ul id="bbp-topic-*">` element inside `<li class="bbp-body">`.
 *
 * Structure per review:
 *   - Rating: `div.wporg-ratings[title="X out of 5 stars"]`
 *   - Title/content: text of `a.bbp-topic-permalink` (excluding the nested rating div)
 *   - Author: `span.bbp-topic-started-by .bbp-author-name`
 *   - Date: `li.bbp-topic-freshness a[title]` (title attr = "March 16, 2026 at 9:40 am")
 *   - Next page: `a.next.page-numbers`
 */
export function parseWordPressReviewPage(html: string, page: number): NormalizedReviewPage {
  const $ = cheerio.load(html);
  const reviews: NormalizedReview[] = [];

  // Each review topic is a <ul id="bbp-topic-*"> inside <li class="bbp-body">
  $("li.bbp-body ul[id^='bbp-topic-']").each((_i, el) => {
    const $el = $(el);

    // Extract star rating from the wporg-ratings div title attr
    const ratingDiv = $el.find(".wporg-ratings");
    let rating = 0;
    const titleAttr = ratingDiv.attr("title") || "";
    const ratingMatch = titleAttr.match(/(\d+)\s*out of\s*5/i);
    if (ratingMatch) {
      rating = parseInt(ratingMatch[1], 10);
    } else {
      // Fallback: count filled stars
      const filledStars = ratingDiv.find(".dashicons-star-filled").length;
      if (filledStars > 0) rating = filledStars;
    }

    // Extract review title text (the permalink text minus the nested rating div)
    const permalink = $el.find("a.bbp-topic-permalink");
    const ratingHtml = permalink.find(".wporg-ratings").remove();
    const content = permalink.text().trim();
    // Restore removed element for later queries
    permalink.append(ratingHtml);

    if (!content && rating === 0) return;

    // Extract reviewer name
    const reviewerName = $el
      .find(".bbp-topic-started-by .bbp-author-name")
      .first()
      .text()
      .trim() || "Anonymous";

    // Extract date from the freshness link title attribute
    // Format: "March 16, 2026 at 9:40 am"
    const freshnessLink = $el.find("li.bbp-topic-freshness a[title]").first();
    const rawDate = freshnessLink.attr("title") || "";
    const reviewDate = parseWpDate(rawDate);

    reviews.push({
      reviewDate,
      content: content || `(${rating} star review)`,
      reviewerName,
      reviewerCountry: "",
      durationUsingApp: "",
      rating,
      developerReplyDate: null,
      developerReplyText: null,
    });
  });

  // Next page link: <a class="next page-numbers" href="...">
  const hasNextPage = $("a.next.page-numbers").length > 0;

  log.info("parsed review page", { page, reviewCount: reviews.length, hasNextPage });

  return {
    reviews,
    hasNextPage,
    currentPage: page,
  };
}

/** Parse "March 16, 2026 at 9:40 am" → "2026-03-16" */
function parseWpDate(dateStr: string): string {
  const months: Record<string, string> = {
    January: "01", February: "02", March: "03", April: "04",
    May: "05", June: "06", July: "07", August: "08",
    September: "09", October: "10", November: "11", December: "12",
  };

  const match = dateStr.match(/(\w+)\s+(\d{1,2}),\s+(\d{4})/);
  if (!match) return dateStr;

  const month = months[match[1]] || "01";
  const day = match[2].padStart(2, "0");
  const year = match[3];
  return `${year}-${month}-${day}`;
}
