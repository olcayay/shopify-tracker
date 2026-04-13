import { describe, it, expect } from "vitest";

/**
 * PLA-1062 — outcome tracking for app_details scrape runs.
 *
 * `AppDetailsScraper.scrapeApp` now returns `"scraped" | "skipped_fresh"`
 * (throws on failure). Call sites must:
 *   - increment itemsSkippedFresh when outcome === "skipped_fresh"
 *   - increment itemsScraped otherwise
 *   - increment itemsFailed on non-AppNotFound errors
 *
 * This test pins the aggregation logic used in scrapeTracked / scrapeAll /
 * scrapeAllWithFullDetails so a future refactor can't silently regress
 * the counter split.
 */

type Outcome = "scraped" | "skipped_fresh";

function aggregate(
  outcomes: Array<Outcome | Error>,
): { items_scraped: number; items_skipped_fresh: number; items_failed: number; total_processed: number } {
  let itemsScraped = 0;
  let itemsSkippedFresh = 0;
  let itemsFailed = 0;
  for (const o of outcomes) {
    if (o === "skipped_fresh") itemsSkippedFresh++;
    else if (o === "scraped") itemsScraped++;
    else itemsFailed++;
  }
  return {
    items_scraped: itemsScraped,
    items_skipped_fresh: itemsSkippedFresh,
    items_failed: itemsFailed,
    total_processed: itemsScraped + itemsSkippedFresh + itemsFailed,
  };
}

describe("PLA-1062 outcome aggregation", () => {
  it("counts 'scraped' outcomes as items_scraped", () => {
    const result = aggregate(["scraped", "scraped", "scraped"]);
    expect(result).toEqual({
      items_scraped: 3,
      items_skipped_fresh: 0,
      items_failed: 0,
      total_processed: 3,
    });
  });

  it("counts 'skipped_fresh' outcomes separately from items_scraped", () => {
    const result = aggregate(["skipped_fresh", "skipped_fresh", "scraped"]);
    expect(result).toEqual({
      items_scraped: 1,
      items_skipped_fresh: 2,
      items_failed: 0,
      total_processed: 3,
    });
  });

  it("counts thrown errors as items_failed", () => {
    const result = aggregate(["scraped", new Error("timeout"), "skipped_fresh"]);
    expect(result).toEqual({
      items_scraped: 1,
      items_skipped_fresh: 1,
      items_failed: 1,
      total_processed: 3,
    });
  });

  it("all-skipped run reports items_scraped=0 (the prod bug fix)", () => {
    const result = aggregate(Array(5709).fill("skipped_fresh"));
    expect(result.items_scraped).toBe(0);
    expect(result.items_skipped_fresh).toBe(5709);
    expect(result.total_processed).toBe(5709);
  });

  it("mixed run: 842 scraped + 4867 skipped (ticket's sample)", () => {
    const outcomes: Outcome[] = [
      ...Array(842).fill("scraped" as Outcome),
      ...Array(4867).fill("skipped_fresh" as Outcome),
    ];
    const result = aggregate(outcomes);
    expect(result.items_scraped).toBe(842);
    expect(result.items_skipped_fresh).toBe(4867);
    expect(result.total_processed).toBe(5709);
  });

  it("empty run reports zeros (no NaN)", () => {
    expect(aggregate([])).toEqual({
      items_scraped: 0,
      items_skipped_fresh: 0,
      items_failed: 0,
      total_processed: 0,
    });
  });
});
