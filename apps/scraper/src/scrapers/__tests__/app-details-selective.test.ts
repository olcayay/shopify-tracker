import { describe, it, expect, vi } from "vitest";

/**
 * PLA-1051: selectFullDetailCandidates chooses apps for the expensive
 * browser-based enrichment path.
 */

vi.mock("@appranks/shared", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  };
});

vi.mock("../../http-client.js", () => ({
  HttpClient: class {},
}));
vi.mock("../../parsers/app-parser.js", () => ({
  parseAppPage: vi.fn(),
  parseSimilarApps: vi.fn(),
}));
vi.mock("../../utils/record-item-error.js", () => ({
  recordItemError: vi.fn(),
}));
vi.mock("../../utils/upsert-snapshot-from-card.js", () => ({
  upsertSnapshotFromCategoryCard: vi.fn(),
}));

import { AppDetailsScraper } from "../app-details-scraper.js";

function mockDbFor(rows: Array<{ id: number; slug: string; isTracked: boolean; latestScrapedAt: Date | null; latestAppDetailsLen: number }>) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockResolvedValue(rows),
  };
  return { select: vi.fn().mockReturnValue(selectChain) } as any;
}

describe("selectFullDetailCandidates (PLA-1051)", () => {
  const now = new Date("2026-04-12T12:00:00Z");

  it("always picks tracked apps", async () => {
    const scraper = new AppDetailsScraper(mockDbFor([
      { id: 1, slug: "tracked-app", isTracked: true, latestScrapedAt: now, latestAppDetailsLen: 10000 },
    ]));
    const res = await scraper.selectFullDetailCandidates({ staleDays: 7, cohortModulus: 7, now });
    expect(res.breakdown.tracked).toBe(1);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].reason).toBe("tracked");
  });

  it("picks apps with no snapshot yet as `new`", async () => {
    const scraper = new AppDetailsScraper(mockDbFor([
      { id: 2, slug: "brand-new", isTracked: false, latestScrapedAt: null, latestAppDetailsLen: 0 },
    ]));
    const res = await scraper.selectFullDetailCandidates({ staleDays: 7, cohortModulus: 7, now });
    expect(res.breakdown.new).toBe(1);
    expect(res.rows[0].reason).toBe("new");
  });

  it("picks seed-only snapshots (appDetailsLen=0) as `new`", async () => {
    const scraper = new AppDetailsScraper(mockDbFor([
      { id: 3, slug: "seed-only", isTracked: false, latestScrapedAt: now, latestAppDetailsLen: 0 },
    ]));
    const res = await scraper.selectFullDetailCandidates({ staleDays: 7, cohortModulus: 7, now });
    expect(res.breakdown.new).toBe(1);
  });

  it("picks apps with snapshots older than staleDays as `stale`", async () => {
    const stale = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const scraper = new AppDetailsScraper(mockDbFor([
      { id: 4, slug: "stale-app", isTracked: false, latestScrapedAt: stale, latestAppDetailsLen: 500 },
    ]));
    const res = await scraper.selectFullDetailCandidates({ staleDays: 7, cohortModulus: 7, now });
    expect(res.breakdown.stale).toBe(1);
    expect(res.rows[0].reason).toBe("stale");
  });

  it("skips fresh non-tracked apps unless they fall into today's cohort", async () => {
    const cohortModulus = 7;
    const dayIdx = Math.floor(now.getTime() / (24 * 60 * 60 * 1000)) % cohortModulus;
    const fresh = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

    const rows = [
      { id: dayIdx, slug: "cohort-match", isTracked: false, latestScrapedAt: fresh, latestAppDetailsLen: 500 },
      { id: dayIdx + 1, slug: "cohort-skip", isTracked: false, latestScrapedAt: fresh, latestAppDetailsLen: 500 },
    ];

    const scraper = new AppDetailsScraper(mockDbFor(rows));
    const res = await scraper.selectFullDetailCandidates({ staleDays: 7, cohortModulus, now });
    expect(res.breakdown.cohort).toBe(1);
    expect(res.rows.some((r) => r.slug === "cohort-match")).toBe(true);
    expect(res.rows.some((r) => r.slug === "cohort-skip")).toBe(false);
  });

  it("emits a full selection_breakdown across all predicates", async () => {
    const fresh = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const stale = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const cohortModulus = 7;
    const dayIdx = Math.floor(now.getTime() / (24 * 60 * 60 * 1000)) % cohortModulus;

    const rows = [
      { id: 100, slug: "a", isTracked: true, latestScrapedAt: fresh, latestAppDetailsLen: 5 },
      { id: 101, slug: "b", isTracked: false, latestScrapedAt: null, latestAppDetailsLen: 0 },
      { id: 102, slug: "c", isTracked: false, latestScrapedAt: stale, latestAppDetailsLen: 5 },
      { id: dayIdx, slug: "d", isTracked: false, latestScrapedAt: fresh, latestAppDetailsLen: 5 },
      { id: 104, slug: "e", isTracked: false, latestScrapedAt: fresh, latestAppDetailsLen: 5 },
    ];

    const scraper = new AppDetailsScraper(mockDbFor(rows));
    const res = await scraper.selectFullDetailCandidates({ staleDays: 7, cohortModulus, now });
    expect(res.breakdown.tracked).toBe(1);
    expect(res.breakdown.new).toBe(1);
    expect(res.breakdown.stale).toBe(1);
    expect(res.breakdown.cohort).toBeGreaterThanOrEqual(0);
    expect(res.breakdown.total).toBe(res.rows.length);
    expect(res.rows.every((r) => ["tracked", "new", "stale", "cohort"].includes(r.reason))).toBe(true);
  });
});
