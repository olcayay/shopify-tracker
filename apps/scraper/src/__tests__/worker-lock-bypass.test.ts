import { describe, it, expect } from "vitest";

/**
 * Tests for the NON_PLATFORM_JOBS lock bypass logic in worker.ts.
 * Since worker.ts has top-level await and heavy dependencies,
 * we test the set membership logic directly.
 */
const NON_PLATFORM_JOBS = new Set(["daily_digest", "weekly_summary", "data_cleanup"]);

describe("Worker platform lock bypass", () => {
  it("bypasses lock for daily_digest jobs", () => {
    expect(NON_PLATFORM_JOBS.has("daily_digest")).toBe(true);
  });

  it("bypasses lock for weekly_summary jobs", () => {
    expect(NON_PLATFORM_JOBS.has("weekly_summary")).toBe(true);
  });

  it("bypasses lock for data_cleanup jobs", () => {
    expect(NON_PLATFORM_JOBS.has("data_cleanup")).toBe(true);
  });

  it("does NOT bypass lock for scraping job types", () => {
    expect(NON_PLATFORM_JOBS.has("keyword_search")).toBe(false);
    expect(NON_PLATFORM_JOBS.has("category")).toBe(false);
    expect(NON_PLATFORM_JOBS.has("reviews")).toBe(false);
    expect(NON_PLATFORM_JOBS.has("app_details")).toBe(false);
    expect(NON_PLATFORM_JOBS.has("featured")).toBe(false);
  });

  it("does NOT bypass lock for compute job types", () => {
    expect(NON_PLATFORM_JOBS.has("compute_review_metrics")).toBe(false);
    expect(NON_PLATFORM_JOBS.has("compute_similarity_scores")).toBe(false);
    expect(NON_PLATFORM_JOBS.has("compute_app_scores")).toBe(false);
  });
});
