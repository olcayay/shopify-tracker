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

  it("flag=true, decimal rating format ('4.80' vs 4.8): treats as unchanged — no spurious drift (PLA-1048 bugfix)", async () => {
    const now = new Date();
    const mockDb = createMockDb({
      latestSnapshot: {
        id: 100,
        scrapedAt: new Date(now.getTime() - 60 * 60 * 1000),
        averageRating: "4.80", // Postgres decimal(3,2) stringification
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

    // Card rating 4.8 — same number, different string shape.
    await (scraper as any).recordNormalizedAppRankings([{ ...sampleApp, averageRating: 4.8 }], "sales", "run-fmt", 0);

    const snapshotInserts = mockDb._insertCalls.filter(
      (v: any) => v && typeof v === "object" && "appIntroduction" in v,
    );
    const fieldChangeInserts = mockDb._insertCalls.filter(
      (v: any) => Array.isArray(v) && v[0]?.field,
    );
    expect(snapshotInserts).toHaveLength(0);
    expect(fieldChangeInserts).toHaveLength(0);
  });

  it("flag=true, empty pricing from card when stored non-empty: preserves stored value, no drift (PLA-1048 bugfix)", async () => {
    const now = new Date();
    const mockDb = createMockDb({
      latestSnapshot: {
        id: 100,
        scrapedAt: new Date(now.getTime() - 60 * 60 * 1000),
        averageRating: "4.50",
        ratingCount: 10,
        pricing: "Paid",
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

    // Card returns no pricing this time (pricingHint undefined).
    await (scraper as any).recordNormalizedAppRankings(
      [{ ...sampleApp, pricingHint: undefined }],
      "sales",
      "run-price",
      0,
    );

    const fieldChangeInserts = mockDb._insertCalls.filter(
      (v: any) => Array.isArray(v) && v[0]?.field,
    );
    // No drift recorded — empty card pricing is treated as no-op.
    const pricingDrift = fieldChangeInserts.flatMap((arr: any[]) => arr).filter((c: any) => c.field === "pricing");
    expect(pricingDrift).toHaveLength(0);
  });

  // PLA-1072: card-pass refresh used to overwrite detail-derived fields with
  // empty values, generating false "before populated → after empty" change
  // rows on /system-admin/app-updates.
  it("PLA-1072: empty shortDescription does NOT generate appIntroduction drift when previous was populated", async () => {
    const now = new Date();
    const mockDb = createMockDb({
      latestSnapshot: {
        id: 100,
        scrapedAt: new Date(now.getTime() - 60 * 60 * 1000),
        averageRating: "4.50",
        ratingCount: 10,
        pricing: "Free",
        appIntroduction: "Detailed description from detail pass",
        developer: { name: "Acme", url: "" },
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

    await (scraper as any).recordNormalizedAppRankings(
      [{ ...sampleApp, shortDescription: "" }],
      "sales",
      "run-empty-intro",
      0,
    );

    const fieldChangeInserts = mockDb._insertCalls.filter(
      (v: any) => Array.isArray(v) && v[0]?.field,
    );
    const introDrift = fieldChangeInserts.flatMap((arr: any[]) => arr).filter((c: any) => c.field === "appIntroduction");
    expect(introDrift).toHaveLength(0);
  });

  it("PLA-1072: missing vendorName does NOT generate developer drift when previous was populated", async () => {
    const now = new Date();
    const mockDb = createMockDb({
      latestSnapshot: {
        id: 100,
        scrapedAt: new Date(now.getTime() - 60 * 60 * 1000),
        averageRating: "4.50",
        ratingCount: 10,
        pricing: "Free",
        appIntroduction: "desc",
        developer: { name: "Acme Corp", url: "https://acme.example" },
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

    // sampleApp.shortDescription === "desc" → no intro drift either.
    // No vendorName passed via opts (recordNormalizedAppRankings does not
    // forward one) — equivalent to vendor missing on a card refresh.
    await (scraper as any).recordNormalizedAppRankings([sampleApp], "sales", "run-no-vendor", 0);

    const fieldChangeInserts = mockDb._insertCalls.filter(
      (v: any) => Array.isArray(v) && v[0]?.field,
    );
    const developerDrift = fieldChangeInserts.flatMap((arr: any[]) => arr).filter((c: any) => c.field === "developer");
    expect(developerDrift).toHaveLength(0);
  });

  it("PLA-1072: card-pass insert preserves detail-only fields from previous snapshot", async () => {
    const now = new Date();
    const previousFeatures = [{ name: "F1", description: "d" }];
    const previousPricingPlans = [{ name: "Pro", price: "$10" }];
    const mockDb = createMockDb({
      latestSnapshot: {
        id: 100,
        scrapedAt: new Date(now.getTime() - 25 * 60 * 60 * 1000), // stale: forces insert
        averageRating: "4.50",
        ratingCount: 10,
        pricing: "Free",
        appIntroduction: "desc",
        developer: { name: "Acme", url: "" },
        appDetails: "Detailed body",
        seoTitle: "SEO title",
        seoMetaDescription: "SEO meta",
        features: previousFeatures,
        pricingPlans: previousPricingPlans,
        demoStoreUrl: "https://demo.example",
        languages: ["en"],
        integrations: ["slack"],
        categories: ["sales"],
        support: { email: "x@y" },
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

    await (scraper as any).recordNormalizedAppRankings([sampleApp], "sales", "run-preserve", 0);

    const snapshotInsert = mockDb._insertCalls.find(
      (v: any) => v && typeof v === "object" && "appIntroduction" in v,
    ) as any;
    expect(snapshotInsert).toBeTruthy();
    expect(snapshotInsert.appDetails).toBe("Detailed body");
    expect(snapshotInsert.seoTitle).toBe("SEO title");
    expect(snapshotInsert.seoMetaDescription).toBe("SEO meta");
    expect(snapshotInsert.features).toEqual(previousFeatures);
    expect(snapshotInsert.pricingPlans).toEqual(previousPricingPlans);
    expect(snapshotInsert.demoStoreUrl).toBe("https://demo.example");
    expect(snapshotInsert.languages).toEqual(["en"]);
    expect(snapshotInsert.integrations).toEqual(["slack"]);
    expect(snapshotInsert.support).toEqual({ email: "x@y" });
    // developer also preserved when card has no vendorName
    expect(snapshotInsert.developer).toEqual({ name: "Acme", url: "" });
  });

  it("PLA-1072: real shortDescription change still recorded", async () => {
    const now = new Date();
    const mockDb = createMockDb({
      latestSnapshot: {
        id: 100,
        scrapedAt: new Date(now.getTime() - 60 * 60 * 1000),
        averageRating: "4.50",
        ratingCount: 10,
        pricing: "Free",
        appIntroduction: "old description",
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

    await (scraper as any).recordNormalizedAppRankings(
      [{ ...sampleApp, shortDescription: "brand new description" }],
      "sales",
      "run-real-change",
      0,
    );

    const fieldChangeInserts = mockDb._insertCalls.filter(
      (v: any) => Array.isArray(v) && v[0]?.field,
    );
    const introDrift = fieldChangeInserts.flatMap((arr: any[]) => arr).filter((c: any) => c.field === "appIntroduction");
    expect(introDrift).toHaveLength(1);
    expect(introDrift[0].newValue).toBe("brand new description");
    expect(introDrift[0].oldValue).toBe("old description");
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
