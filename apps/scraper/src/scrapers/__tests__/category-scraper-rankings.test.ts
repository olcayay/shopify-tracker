import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// PLA-458: Verify that recordNormalizedAppRankings uses onConflictDoNothing
// to prevent duplicate key constraint errors on idx_app_cat_rank_daily_unique.
//
// We test this by creating a CategoryScraper with a mock DB that tracks
// the insert chain, then calling the private method via prototype trick.
// ---------------------------------------------------------------------------

// Mock all heavy deps so the module loads without side-effects
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

function createMockDb() {
  const chain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1 }]),
  };

  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ id: 1 }]), // existing snapshot found — skip insert
  };

  const db = {
    insert: vi.fn().mockReturnValue(chain),
    select: vi.fn().mockReturnValue(selectChain),
    _chain: chain,
  };

  return db;
}

describe("recordNormalizedAppRankings — onConflictDoNothing (PLA-458)", () => {
  it("should call onConflictDoNothing on appCategoryRankings insert", async () => {
    const mockDb = createMockDb();
    const scraper = new CategoryScraper(mockDb as any, {
      platformModule: {
        platformId: "salesforce",
        constants: { seedCategories: ["sales"], maxCategoryDepth: 1, isFlat: true },
      } as any,
    });

    const apps = [
      {
        slug: "test-app",
        name: "Test App",
        shortDescription: "desc",
        averageRating: 4.5,
        ratingCount: 10,
        pricingHint: "Free",
        logoUrl: "https://example.com/logo.png",
        isSponsored: false,
        position: 1,
        badges: [],
      },
    ];

    // Call private method
    await (scraper as any).recordNormalizedAppRankings(apps, "sales", "run-123", 0);

    // The insert should have been called twice: once for app upsert, once for ranking
    expect(mockDb.insert).toHaveBeenCalledTimes(2);

    // The second insert (ranking) should chain .onConflictDoNothing()
    // After .values() on the ranking insert, onConflictDoNothing should be called
    expect(mockDb._chain.onConflictDoNothing).toHaveBeenCalled();
  });

  it("should not throw when duplicate ranking is inserted (onConflictDoNothing absorbs it)", async () => {
    const mockDb = createMockDb();
    const scraper = new CategoryScraper(mockDb as any, {
      platformModule: {
        platformId: "canva",
        constants: { seedCategories: ["design"], maxCategoryDepth: 1, isFlat: true },
      } as any,
    });

    const apps = [
      {
        slug: "dup-app",
        name: "Duplicate App",
        shortDescription: "desc",
        averageRating: 3.0,
        ratingCount: 5,
        pricingHint: "Free",
        logoUrl: null,
        isSponsored: false,
        position: 1,
        badges: [],
      },
    ];

    // Insert same app twice — should not throw
    await (scraper as any).recordNormalizedAppRankings(apps, "design", "run-1", 0);
    await (scraper as any).recordNormalizedAppRankings(apps, "design", "run-1", 0);

    // onConflictDoNothing called at least twice (once per insert)
    expect(mockDb._chain.onConflictDoNothing).toHaveBeenCalledTimes(2);
  });

  it("should skip sponsored apps (no ranking insert)", async () => {
    const mockDb = createMockDb();
    const scraper = new CategoryScraper(mockDb as any, {
      platformModule: {
        platformId: "wix",
        constants: { seedCategories: ["marketing"], maxCategoryDepth: 1, isFlat: true },
      } as any,
    });

    const apps = [
      {
        slug: "sponsored-app",
        name: "Sponsored App",
        shortDescription: "ad",
        averageRating: 5.0,
        ratingCount: 100,
        pricingHint: "Paid",
        logoUrl: null,
        isSponsored: true,
        position: 1,
        badges: [],
      },
    ];

    await (scraper as any).recordNormalizedAppRankings(apps, "marketing", "run-1", 0);

    // Sponsored apps are skipped entirely — no insert calls
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
