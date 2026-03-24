import { describe, it, expect } from "vitest";
import { parseWordPressReviewPage } from "../parsers/review-parser.js";

const SAMPLE_HTML = `
<html><body>
<li class="bbp-body">
  <ul id="bbp-topic-111" class="loop-item-0 odd post-111 topic type-topic status-publish hentry">
    <li class="bbp-topic-title">
      <a class="bbp-topic-permalink" href="/support/topic/great-plugin/">Great plugin
        <div class='wporg-ratings' title='5 out of 5 stars' style='color:#e26f56;'>
          <span class="dashicons dashicons-star-filled"></span>
          <span class="dashicons dashicons-star-filled"></span>
          <span class="dashicons dashicons-star-filled"></span>
          <span class="dashicons dashicons-star-filled"></span>
          <span class="dashicons dashicons-star-filled"></span>
        </div>
      </a>
      <p class="bbp-topic-meta">
        <span class="bbp-topic-started-by">Started by:
          <a href="/support/users/alice/" class="bbp-author-link">
            <span class="bbp-author-name">alice</span>
          </a>
        </span>
      </p>
    </li>
    <li class="bbp-topic-voice-count">1</li>
    <li class="bbp-topic-reply-count">0</li>
    <li class="bbp-topic-freshness">
      <a href="/support/topic/great-plugin/" title="January 15, 2026 at 3:22 pm">2 months ago</a>
      <p class="bbp-topic-meta">
        <span class="bbp-topic-freshness-author">
          <a href="/support/users/alice/" class="bbp-author-link">
            <span class="bbp-author-name">alice</span>
          </a>
        </span>
      </p>
    </li>
  </ul>

  <ul id="bbp-topic-222" class="loop-item-1 even post-222 topic type-topic status-publish hentry">
    <li class="bbp-topic-title">
      <a class="bbp-topic-permalink" href="/support/topic/needs-work/">Needs work
        <div class='wporg-ratings' title='2 out of 5 stars'>
          <span class="dashicons dashicons-star-filled"></span>
          <span class="dashicons dashicons-star-filled"></span>
          <span class="dashicons dashicons-star-empty"></span>
          <span class="dashicons dashicons-star-empty"></span>
          <span class="dashicons dashicons-star-empty"></span>
        </div>
      </a>
      <p class="bbp-topic-meta">
        <span class="bbp-topic-started-by">Started by:
          <a href="/support/users/bob/" class="bbp-author-link">
            <span class="bbp-author-name">bob</span>
          </a>
        </span>
      </p>
    </li>
    <li class="bbp-topic-voice-count">2</li>
    <li class="bbp-topic-reply-count">1</li>
    <li class="bbp-topic-freshness">
      <a href="/support/topic/needs-work/" title="December 5, 2025 at 10:00 am">3 months ago</a>
    </li>
  </ul>
</li>

<a class="next page-numbers" href="/reviews/page/2/">&rarr;</a>
</body></html>`;

describe("parseWordPressReviewPage", () => {
  it("parses reviews from BBPress forum markup", () => {
    const result = parseWordPressReviewPage(SAMPLE_HTML, 1);
    expect(result.reviews.length).toBe(2);
    expect(result.currentPage).toBe(1);
    expect(result.hasNextPage).toBe(true);
  });

  it("extracts rating from wporg-ratings title attribute", () => {
    const result = parseWordPressReviewPage(SAMPLE_HTML, 1);
    expect(result.reviews[0].rating).toBe(5);
    expect(result.reviews[1].rating).toBe(2);
  });

  it("extracts review title as content", () => {
    const result = parseWordPressReviewPage(SAMPLE_HTML, 1);
    expect(result.reviews[0].content).toBe("Great plugin");
    expect(result.reviews[1].content).toBe("Needs work");
  });

  it("extracts reviewer name from bbp-author-name", () => {
    const result = parseWordPressReviewPage(SAMPLE_HTML, 1);
    expect(result.reviews[0].reviewerName).toBe("alice");
    expect(result.reviews[1].reviewerName).toBe("bob");
  });

  it("parses date from freshness link title attribute", () => {
    const result = parseWordPressReviewPage(SAMPLE_HTML, 1);
    expect(result.reviews[0].reviewDate).toBe("2026-01-15");
    expect(result.reviews[1].reviewDate).toBe("2025-12-05");
  });

  it("detects next page link", () => {
    const result = parseWordPressReviewPage(SAMPLE_HTML, 1);
    expect(result.hasNextPage).toBe(true);
  });

  it("detects no next page when link is absent", () => {
    const noNextHtml = SAMPLE_HTML.replace(
      '<a class="next page-numbers" href="/reviews/page/2/">&rarr;</a>',
      ""
    );
    const result = parseWordPressReviewPage(noNextHtml, 3);
    expect(result.hasNextPage).toBe(false);
    expect(result.currentPage).toBe(3);
  });

  it("returns empty reviews for empty HTML", () => {
    const result = parseWordPressReviewPage("<html><body></body></html>", 1);
    expect(result.reviews.length).toBe(0);
    expect(result.hasNextPage).toBe(false);
  });

  it("falls back to star counting when title attribute is missing", () => {
    const noTitleHtml = SAMPLE_HTML
      .replace("title='5 out of 5 stars'", "")
      .replace("title='2 out of 5 stars'", "");
    const result = parseWordPressReviewPage(noTitleHtml, 1);
    expect(result.reviews[0].rating).toBe(5);
    expect(result.reviews[1].rating).toBe(2);
  });
});
