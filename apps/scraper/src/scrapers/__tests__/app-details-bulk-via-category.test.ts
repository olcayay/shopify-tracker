import { describe, it, expect, vi } from "vitest";

/**
 * PLA-1048: scrapeAllViaCategoryApi refreshes every app using only the
 * platform's category API — no browser, no per-app fetch. Tests cover the
 * aggregation, failure tolerance, and snapshot insertion path.
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

vi.mock("../../parsers/app-parser.js", () => ({
  parseAppPage: vi.fn(),
  parseSimilarApps: vi.fn(),
}));

vi.mock("../../utils/record-item-error.js", () => ({
  recordItemError: vi.fn(),
}));

import { AppDetailsScraper } from "../app-details-scraper.js";
import { upsertSnapshotFromCategoryCard } from "../../utils/upsert-snapshot-from-card.js";

vi.mock("../../utils/upsert-snapshot-from-card.js", () => ({
  upsertSnapshotFromCategoryCard: vi.fn().mockResolvedValue({
    inserted: true,
    driftFields: [],
    reason: "seed",
  }),
}));

function makeCard(slug: string, over: Partial<any> = {}) {
  return {
    slug,
    name: `App ${slug}`,
    shortDescription: "desc",
    averageRating: 4.5,
    ratingCount: 10,
    logoUrl: "https://example.com/logo.png",
    pricingHint: "Free",
    isSponsored: false,
    badges: [] as string[],
    ...over,
  };
}

function createMockDb() {
  const insertArgs: unknown[] = [];
  const updateArgs: unknown[] = [];
  const insertChain = {
    values: vi.fn(function (this: any, v: unknown) {
      insertArgs.push(v);
      return this;
    }),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: Math.floor(Math.random() * 1e6) }]),
  };
  const updateChain = {
    set: vi.fn(function (this: any, v: unknown) {
      updateArgs.push(v);
      return this;
    }),
    where: vi.fn().mockResolvedValue(undefined),
  };
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  return {
    insert: vi.fn().mockImplementation((table: any) => {
      // .insert(scrapeRuns).values({...}).returning() returns run row
      if (table && typeof table === "object" && table._returning) {
        return { ...insertChain };
      }
      return insertChain;
    }),
    update: vi.fn().mockReturnValue(updateChain),
    select: vi.fn().mockReturnValue(selectChain),
    _insertArgs: insertArgs,
    _updateArgs: updateArgs,
    _chain: insertChain,
  };
}

function buildScraper(mockDb: any, fetches: Record<string, { apps: any[]; subLinks?: string[] } | Error>, overrides: any = {}) {
  const fetchCategoryPage = vi.fn(async (slug: string) => {
    const v = fetches[slug];
    if (!v) return "{}";
    if (v instanceof Error) throw v;
    return JSON.stringify({ __slug: slug });
  });
  const parseCategoryPage = vi.fn((raw: string, urlOrSlug: string) => {
    const data = JSON.parse(raw);
    const slug = data.__slug ?? urlOrSlug;
    const v = fetches[slug];
    if (!v || v instanceof Error) return { slug, url: "", title: "", description: "", appCount: 0, apps: [], subcategoryLinks: [], hasNextPage: false };
    return {
      slug,
      url: "",
      title: "",
      description: "",
      appCount: v.apps.length,
      apps: v.apps,
      subcategoryLinks: (v.subLinks ?? []).map((s) => ({ slug: s, url: "", title: s })),
      hasNextPage: false,
    };
  });

  const platformModule = {
    platformId: "salesforce",
    constants: {
      seedCategories: ["sales", "marketing"],
      maxCategoryDepth: 1,
      refreshSnapshotFromCategoryCard: true,
      refreshSnapshotMaxAgeMs: 20 * 60 * 60 * 1000,
      concurrentSeedCategories: 2,
      ...overrides,
    },
    fetchCategoryPage,
    parseCategoryPage,
  } as any;

  const scraper = new AppDetailsScraper(mockDb, undefined, platformModule);
  scraper.jobId = "job-123";
  return { scraper, fetchCategoryPage, parseCategoryPage };
}

describe("scrapeAllViaCategoryApi (PLA-1048)", () => {
  it("dedupes apps across overlapping categories", async () => {
    const mockDb = createMockDb();
    const shared = makeCard("shared-app");
    const only1 = makeCard("only-sales");
    const only2 = makeCard("only-marketing");
    const { scraper } = buildScraper(mockDb, {
      sales: { apps: [shared, only1] },
      marketing: { apps: [shared, only2] },
    });

    await scraper.scrapeAllViaCategoryApi("test", "background", false);

    const upsertCalls = (upsertSnapshotFromCategoryCard as any).mock.calls;
    const slugsSeen = upsertCalls.map((c: any[]) => c[2].slug);
    expect(new Set(slugsSeen)).toEqual(new Set(["shared-app", "only-sales", "only-marketing"]));
    expect(upsertCalls.length).toBe(3);
  });

  it("continues when one category fetch throws", async () => {
    (upsertSnapshotFromCategoryCard as any).mockClear();
    const mockDb = createMockDb();
    const { scraper } = buildScraper(mockDb, {
      sales: { apps: [makeCard("a1")] },
      marketing: new Error("boom"),
    });

    await expect(scraper.scrapeAllViaCategoryApi("test", "background", false)).resolves.toBeUndefined();
    expect((upsertSnapshotFromCategoryCard as any).mock.calls.length).toBe(1);
  });

  it("accepts cards with zero rating and still invokes the snapshot helper", async () => {
    (upsertSnapshotFromCategoryCard as any).mockClear();
    const mockDb = createMockDb();
    const zeroRated = makeCard("no-ratings", { averageRating: 0, ratingCount: 0, shortDescription: "" });
    const { scraper } = buildScraper(mockDb, {
      sales: { apps: [zeroRated] },
      marketing: { apps: [] },
    });

    await scraper.scrapeAllViaCategoryApi("test", "background", false);

    expect((upsertSnapshotFromCategoryCard as any).mock.calls.length).toBe(1);
    const card = (upsertSnapshotFromCategoryCard as any).mock.calls[0][2];
    expect(card.slug).toBe("no-ratings");
  });

  it("recurses into subcategoryLinks up to maxCategoryDepth", async () => {
    (upsertSnapshotFromCategoryCard as any).mockClear();
    const mockDb = createMockDb();
    const { scraper, fetchCategoryPage } = buildScraper(mockDb, {
      sales: { apps: [makeCard("root-app")], subLinks: ["sales-child"] },
      marketing: { apps: [] },
      "sales-child": { apps: [makeCard("child-app")] },
    });

    await scraper.scrapeAllViaCategoryApi("test", "background", false);

    const fetchedSlugs = fetchCategoryPage.mock.calls.map((c: any) => c[0]);
    expect(new Set(fetchedSlugs)).toEqual(new Set(["sales", "marketing", "sales-child"]));
    const cardSlugs = (upsertSnapshotFromCategoryCard as any).mock.calls.map((c: any[]) => c[2].slug);
    expect(new Set(cardSlugs)).toEqual(new Set(["root-app", "child-app"]));
  });

  it("does not create a browser client (handled at process-job level); throws without platform module", async () => {
    const mockDb = createMockDb();
    const scraper = new AppDetailsScraper(mockDb as any);
    await expect(scraper.scrapeAllViaCategoryApi("test", "background", false)).rejects.toThrow(/platform module/);
  });
});
