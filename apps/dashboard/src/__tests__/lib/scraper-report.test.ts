import { describe, it, expect } from "vitest";
import {
  buildItemReport,
  buildRunReport,
  buildFallbackReport,
  buildSmokeTestReport,
  formatDurationForReport,
  type RunInfo,
  type ItemError,
} from "@/lib/scraper-report";

const baseRun: RunInfo = {
  id: "run-123",
  platform: "shopify",
  scraperType: "keyword_search",
  status: "completed",
  triggeredBy: "scheduler",
  queue: "background",
  jobId: "456",
  startedAt: "2026-03-26T10:00:00Z",
  completedAt: "2026-03-26T10:05:00Z",
  metadata: {
    duration_ms: 300000,
    items_scraped: 50,
    items_failed: 2,
  },
};

const baseError: ItemError = {
  itemIdentifier: "form builder",
  itemType: "keyword",
  url: "https://apps.shopify.com/search?q=form+builder",
  errorMessage: "HTTP 429: Too Many Requests",
  stackTrace: "Error: HTTP 429\n    at fetch (http-client.ts:100)",
  createdAt: "2026-03-26T10:04:30Z",
};

describe("buildItemReport", () => {
  it("includes run info and item error", () => {
    const report = buildItemReport(baseRun, baseError);
    expect(report).toContain("=== SCRAPE ITEM ERROR REPORT ===");
    expect(report).toContain("Run ID:       run-123");
    expect(report).toContain("Platform:     shopify");
    expect(report).toContain("Scraper Type: keyword_search");
    expect(report).toContain("Triggered By: scheduler");
    expect(report).toContain("Queue:        background");
    expect(report).toContain("Job ID:       456");
    expect(report).toContain("Items:        50 scraped, 2 failed");
    expect(report).toContain("--- Failed Item 1/1 ---");
    expect(report).toContain("Identifier:   form builder");
    expect(report).toContain("URL:          https://apps.shopify.com/search?q=form+builder");
    expect(report).toContain("HTTP 429: Too Many Requests");
    expect(report).toContain("Stack Trace:");
  });

  it("includes scraper file mapping", () => {
    const report = buildItemReport(baseRun, baseError);
    expect(report).toContain("Scraper File: apps/scraper/src/scrapers/keyword-scraper.ts");
  });

  it("maps all known scraper types to files", () => {
    for (const [type, file] of [
      ["app_details", "app-details-scraper.ts"],
      ["keyword_search", "keyword-scraper.ts"],
      ["reviews", "review-scraper.ts"],
      ["category", "category-scraper.ts"],
    ]) {
      const report = buildItemReport({ ...baseRun, scraperType: type }, baseError);
      expect(report).toContain(file);
    }
  });

  it("handles missing optional fields gracefully", () => {
    const minimalRun: RunInfo = { platform: "canva" };
    const minimalError: ItemError = {
      itemIdentifier: "test",
      itemType: "app",
      errorMessage: "fail",
    };
    const report = buildItemReport(minimalRun, minimalError);
    expect(report).toContain("Run ID:       N/A");
    expect(report).toContain("Platform:     canva");
    expect(report).toContain("Started:      N/A");
    expect(report).toContain("URL:          N/A");
    expect(report).not.toContain("Stack Trace:");
    expect(report).not.toContain("Triggered By:");
  });
});

describe("buildRunReport", () => {
  it("includes run error when present", () => {
    const run = { ...baseRun, error: "job-level failure: timeout" };
    const report = buildRunReport(run);
    expect(report).toContain("=== SCRAPE RUN ERROR REPORT ===");
    expect(report).toContain("--- Run Error ---");
    expect(report).toContain("job-level failure: timeout");
  });

  it("includes multiple item errors", () => {
    const errors: ItemError[] = [
      { ...baseError, itemIdentifier: "keyword-1" },
      { ...baseError, itemIdentifier: "keyword-2" },
      { ...baseError, itemIdentifier: "keyword-3" },
    ];
    const report = buildRunReport(baseRun, errors);
    expect(report).toContain("--- Failed Item 1/3 ---");
    expect(report).toContain("Identifier:   keyword-1");
    expect(report).toContain("--- Failed Item 2/3 ---");
    expect(report).toContain("Identifier:   keyword-2");
    expect(report).toContain("--- Failed Item 3/3 ---");
    expect(report).toContain("Identifier:   keyword-3");
  });

  it("works with no errors", () => {
    const report = buildRunReport(baseRun);
    expect(report).toContain("=== SCRAPE RUN ERROR REPORT ===");
    expect(report).not.toContain("--- Run Error ---");
    expect(report).not.toContain("--- Failed Item");
  });

  it("includes fallback info when present", () => {
    const run: RunInfo = {
      ...baseRun,
      metadata: {
        ...baseRun.metadata,
        fallback_used: true,
        fallback_count: 3,
        fallback_contexts: ["ctx/a", "ctx/b", "ctx/c"],
      },
    };
    const report = buildRunReport(run);
    expect(report).toContain("Fallback:     Yes (3 fallbacks)");
    expect(report).toContain("Contexts:     ctx/a, ctx/b, ctx/c");
  });

  it("shows singular fallback label for count 1", () => {
    const run: RunInfo = {
      ...baseRun,
      metadata: { ...baseRun.metadata, fallback_used: true, fallback_count: 1 },
    };
    const report = buildRunReport(run);
    expect(report).toContain("Fallback:     Yes (1 fallback)");
  });
});

describe("buildFallbackReport", () => {
  it("uses FALLBACK header", () => {
    const run: RunInfo = {
      ...baseRun,
      metadata: { ...baseRun.metadata, fallback_used: true, fallback_count: 2 },
    };
    const report = buildFallbackReport(run);
    expect(report).toContain("=== SCRAPER FALLBACK REPORT ===");
    expect(report).toContain("Fallback:     Yes (2 fallbacks)");
  });

  it("includes run error if present", () => {
    const run: RunInfo = { ...baseRun, error: "something broke" };
    const report = buildFallbackReport(run);
    expect(report).toContain("--- Run Error ---");
    expect(report).toContain("something broke");
  });

  it("includes schedule when present", () => {
    const run: RunInfo = { ...baseRun, schedule: "0 3 * * *" };
    const report = buildFallbackReport(run);
    expect(report).toContain("Schedule:     0 3 * * *");
  });
});

describe("formatDurationForReport", () => {
  it("shows ms for sub-second durations", () => {
    expect(formatDurationForReport(500)).toBe("500ms");
    expect(formatDurationForReport(0)).toBe("0ms");
    expect(formatDurationForReport(999)).toBe("999ms");
  });

  it("shows seconds for durations under 1 minute", () => {
    expect(formatDurationForReport(1000)).toBe("1.0s");
    expect(formatDurationForReport(30453)).toBe("30.5s");
    expect(formatDurationForReport(59999)).toBe("60.0s");
  });

  it("shows minutes + seconds for durations over 1 minute", () => {
    expect(formatDurationForReport(60000)).toBe("1m 0s");
    expect(formatDurationForReport(154000)).toBe("2m 34s");
    expect(formatDurationForReport(300000)).toBe("5m 0s");
    expect(formatDurationForReport(7547297)).toBe("125m 47s");
  });
});

describe("buildSmokeTestReport", () => {
  it("includes test subject from SMOKE_PLATFORMS config", () => {
    const report = buildSmokeTestReport({
      platform: "shopify",
      check: "app",
      status: "pass",
      durationMs: 5000,
    });
    expect(report).toContain("Test Subject: trendsi");
    expect(report).toContain("Client Type:  http");
    expect(report).toContain("Timeout:      60s");
  });

  it("includes test subject for keyword checks with --pages arg", () => {
    const report = buildSmokeTestReport({
      platform: "shopify",
      check: "keyword",
      status: "pass",
      durationMs: 12000,
    });
    expect(report).toContain("Test Subject: email marketing --pages first");
  });

  it("shows duration in human-readable seconds", () => {
    const report = buildSmokeTestReport({
      platform: "canva",
      check: "app",
      status: "fail",
      durationMs: 30453,
    });
    expect(report).toContain("Duration:     30.5s");
    expect(report).not.toContain("30453ms");
  });

  it("annotates exit code 143 with SIGTERM explanation", () => {
    const report = buildSmokeTestReport({
      platform: "google_workspace",
      check: "app",
      status: "fail",
      durationMs: 60588,
      error: "exit code 143",
    });
    expect(report).toContain("exit code 143 (SIGTERM — likely killed by timeout)");
    expect(report).toContain("Client Type:  http");
    expect(report).toContain("Timeout:      60s");
  });

  it("shows browser client type for browser platforms", () => {
    const report = buildSmokeTestReport({
      platform: "canva",
      check: "keyword",
      status: "fail",
      durationMs: 121926,
      error: "exit code 143",
    });
    expect(report).toContain("Client Type:  browser");
    expect(report).toContain("Timeout:      120s");
  });

  it("handles unknown platforms gracefully", () => {
    const report = buildSmokeTestReport({
      platform: "unknown_platform",
      check: "app",
      status: "fail",
    });
    expect(report).toContain("Platform:     unknown_platform");
    expect(report).not.toContain("Client Type:");
    expect(report).not.toContain("Test Subject:");
  });
});

describe("duration formatting in run reports", () => {
  it("buildRunReport shows duration in seconds", () => {
    const report = buildRunReport(baseRun);
    expect(report).toContain("Duration:     5m 0s");
    expect(report).not.toContain("300000ms");
  });
});
