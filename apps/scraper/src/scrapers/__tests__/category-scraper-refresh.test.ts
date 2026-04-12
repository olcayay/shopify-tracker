import { describe, it, expect, vi } from "vitest";

/**
 * PLA-1049: refreshSnapshotFromCategoryCard flag lets the category scraper
 * refresh snapshots on every run for platforms whose category API already
 * carries the tracked fields (e.g. Salesforce). Default behaviour (flag off)
 * remains seed-once.
 */

vi.mock("@appranks/shared", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  };
});

vi.mock("../../http-client.js", () => ({
  HttpClient: class {},
}));

vi.mock("../../parsers/category-parser.js", () => ({
  parseCategoryPage: vi.fn(),
  hasNextPage: vi.fn(),
}));

vi.mock("../../parsers/featured-parser.js", () => ({
  parseFeaturedSections: vi.fn(),
}));

vi.mock("../../utils/record-item-error.js", () => ({
  recordItemError: vi.fn(),
}));

import { CategoryScraper } from "../category-scraper.js";

interface MockOptions {
  latestSnapshot?: Record<string, unknown> | null;
}

function createMockDb(opts: MockOptions = {}) {
  const insertCalls: unknown[] = [];
  const insertChain = {
    values: vi.fn(function (this: any, v: unknown) {
      insertCalls.push(v);
      return this;
    }),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 42 }]),
  };

  const snap = opts.latestSnapshot ?? null;
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(snap ? [snap] : []),
  };

  const db = {
    insert: vi.fn().mockReturnValue(insertChain),
    select: vi.fn().mockReturnValue(selectChain),
    _insertCalls: insertCalls,
    _chain: insertChain,
  };

  return db;
}

const sampleApp = {
  slug: "my-app",
  name: "My App",
  shortDescription: "desc",
  averageRating: 4.5,
  ratingCount: 10,
  pricingHint: "Free",
  logoUrl: "https://example.com/logo.png",
  isSponsored: false,
  position: 1,
  badges: [] as string[],
};

describe("upsertSnapshotFromCategoryCard (PLA-1049)", () => {
  it("flag=false: skips insert when a snapshot already exists (seed-once)", async () => {
    const mockDb = createMockDb({ latestSnapshot: { id: 1 } });
    const scraper = new CategoryScraper(mockDb as any, {
      platformModule: {
        platformId: "canva",
        constants: { seedCategories: ["design"], maxCategoryDepth: 1 },
      } as any,
    });

    await (scraper as any).recordNormalizedAppRankings([sampleApp], "design", "run-1", 0);

    const snapshotInserts = mockDb._insertCalls.filter(
      (v: any) => v && typeof v === "object" && "appIntroduction" in v,
    );
    expect(snapshotInserts).toHaveLength(0);
  });

  it("flag=false, no snapshot yet: inserts exactly one seed snapshot", async () => {
    const mockDb = createMockDb({ latestSnapshot: null });
    const scraper = new CategoryScraper(mockDb as any, {
      platformModule: {
        platformId: "canva",
        constants: { seedCategories: ["design"], maxCategoryDepth: 1 },
      } as any,
    });

    await (scraper as any).recordNormalizedAppRankings([sampleApp], "design", "run-1", 0);

    const snapshotInserts = mockDb._insertCalls.filter(
      (v: any) => v && typeof v === "object" && "appIntroduction" in v,
    );
    expect(snapshotInserts).toHaveLength(1);
  });

  it("flag=true, tracked field changed: inserts new snapshot + appFieldChanges", async () => {
    const now = new Date();
    const mockDb = createMockDb({
      latestSnapshot: {
        id: 100,
        scrapedAt: new Date(now.getTime() - 60 * 60 * 1000), // 1h ago, fresh
        averageRating: "4.0",
        ratingCount: 10,
        pricing: "Free",
        appIntroduction: "desc",
        developer: null,
      },
    });
    const scraper = new CategoryScraper(mockDb as any, {
      platformModule: {
        platformId: "salesforce",
        constants: {
          seedCategories: ["sales"],
          maxCategoryDepth: 1,
          refreshSnapshotFromCategoryCard: true,
          refreshSnapshotMaxAgeMs: 20 * 60 * 60 * 1000,
        },
      } as any,
    });

    await (scraper as any).recordNormalizedAppRankings([sampleApp], "sales", "run-2", 0);

    const snapshotInserts = mockDb._insertCalls.filter(
      (v: any) => v && typeof v === "object" && "appIntroduction" in v,
    );
    const fieldChangeInserts = mockDb._insertCalls.filter(
      (v: any) => Array.isArray(v) && v[0]?.field,
    );
    expect(snapshotInserts).toHaveLength(1);
    expect(fieldChangeInserts).toHaveLength(1);
    const changedFields = (fieldChangeInserts[0] as any[]).map((c) => c.field);
    expect(changedFields).toContain("averageRating"); // 4.0 → 4.5
  });

  it("flag=true, no change, snapshot fresh: no insert (idempotent)", async () => {
    const now = new Date();
    const mockDb = createMockDb({
      latestSnapshot: {
        id: 100,
        scrapedAt: new Date(now.getTime() - 60 * 60 * 1000), // 1h ago
        averageRating: "4.5",
        ratingCount: 10,
        pricing: "Free",
        appIntroduction: "desc",
        developer: null,
      },
    });
    const scraper = new CategoryScraper(mockDb as any, {
      platformModule: {
        platformId: "salesforce",
        constants: {
          seedCategories: ["sales"],
          maxCategoryDepth: 1,
          refreshSnapshotFromCategoryCard: true,
          refreshSnapshotMaxAgeMs: 20 * 60 * 60 * 1000,
        },
      } as any,
    });

    await (scraper as any).recordNormalizedAppRankings([sampleApp], "sales", "run-3", 0);

    const snapshotInserts = mockDb._insertCalls.filter(
      (v: any) => v && typeof v === "object" && "appIntroduction" in v,
    );
    expect(snapshotInserts).toHaveLength(0);
  });

  it("flag=true, no change but snapshot stale (>20h): inserts refreshed snapshot, no field changes", async () => {
    const now = new Date();
    const mockDb = createMockDb({
      latestSnapshot: {
        id: 100,
        scrapedAt: new Date(now.getTime() - 25 * 60 * 60 * 1000), // 25h ago
        averageRating: "4.5",
        ratingCount: 10,
        pricing: "Free",
        appIntroduction: "desc",
        developer: null,
      },
    });
    const scraper = new CategoryScraper(mockDb as any, {
      platformModule: {
        platformId: "salesforce",
        constants: {
          seedCategories: ["sales"],
          maxCategoryDepth: 1,
          refreshSnapshotFromCategoryCard: true,
          refreshSnapshotMaxAgeMs: 20 * 60 * 60 * 1000,
        },
      } as any,
    });

    await (scraper as any).recordNormalizedAppRankings([sampleApp], "sales", "run-4", 0);

    const snapshotInserts = mockDb._insertCalls.filter(
      (v: any) => v && typeof v === "object" && "appIntroduction" in v,
    );
    const fieldChangeInserts = mockDb._insertCalls.filter(
      (v: any) => Array.isArray(v) && v[0]?.field,
    );
    expect(snapshotInserts).toHaveLength(1);
    expect(fieldChangeInserts).toHaveLength(0);
  });
});
