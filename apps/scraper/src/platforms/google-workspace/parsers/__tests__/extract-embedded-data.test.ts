import { describe, it, expect } from "vitest";
import {
  extractAfData,
  parseAppEntry,
  extractAppEntries,
  extractReviewEntries,
  normalizePricingFromCodes,
  mapWorksWithCodes,
  type GWorkspaceAppEntry,
} from "../extract-embedded-data.js";

// ── Helpers ──────────────────────────────────────────────────────────────

/** Build a minimal HTML page with an AF_initDataCallback block. */
function buildAfHtml(key: string, data: unknown): string {
  const json = JSON.stringify(data);
  return `<html><head><script>AF_initDataCallback({key: '${key}', hash: '1', data:${json}, sideChannel: {}});</script></head><body></body></html>`;
}

/** Build a 35-field app entry array used by the marketplace. */
function buildRawAppEntry(overrides: Partial<{
  appId: number;
  name: string;
  shortDescription: string;
  detailedDescription: string;
  iconUrl: string;
  bannerUrl: string;
  slug: string;
  developerName: string;
  developerWebsite: string;
  developerAddress: string;
  reviewCount: number;
  rating: number;
  installCountDisplay: string;
  installCountExact: number | null;
  termsOfServiceUrl: string;
  privacyPolicyUrl: string;
  supportUrl: string;
  homepageUrl: string;
  pricingRaw: number[][];
  worksWithCodes: number[];
  lastUpdatedTimestamp: number | null;
}> = {}): unknown[] {
  const o = {
    appId: 123456789,
    name: "Test App",
    shortDescription: "A short description",
    detailedDescription: "A detailed description of the app",
    iconUrl: "https://lh3.googleusercontent.com/icon.png",
    bannerUrl: "https://lh3.googleusercontent.com/banner.png",
    slug: "test-app",
    developerName: "Test Dev Co",
    developerWebsite: "https://testdev.com",
    developerAddress: "123 Dev Street",
    reviewCount: 42,
    rating: 4.5,
    installCountDisplay: "10,000+",
    installCountExact: 10000,
    termsOfServiceUrl: "https://testdev.com/tos",
    privacyPolicyUrl: "https://testdev.com/privacy",
    supportUrl: "https://testdev.com/support",
    homepageUrl: "https://testdev.com",
    pricingRaw: [[4, "Free"]],
    worksWithCodes: [5, 6],
    lastUpdatedTimestamp: 1700000000,
    ...overrides,
  };

  // Build a 22+ element array matching the positional structure
  const entry: unknown[] = new Array(22).fill(null);
  entry[0] = o.appId;
  // entry[1] and entry[2] are null
  entry[3] = [o.name, o.shortDescription, o.detailedDescription, o.iconUrl, o.bannerUrl, o.slug];
  entry[4] = [o.developerName, o.developerWebsite, null, o.developerAddress];
  entry[5] = [o.reviewCount, o.rating, o.installCountDisplay, o.installCountExact];
  // entry[6], entry[7] null
  entry[8] = [null, o.termsOfServiceUrl, o.privacyPolicyUrl, o.supportUrl, o.homepageUrl];
  // entry[9..11] null
  entry[12] = o.worksWithCodes;
  // entry[13], entry[14] null
  entry[15] = o.pricingRaw;
  // entry[16..20] null
  entry[21] = [o.lastUpdatedTimestamp];

  return entry;
}

// ── extractAfData ────────────────────────────────────────────────────────

describe("extractAfData", () => {
  it("extracts data array from AF_initDataCallback by key", () => {
    const data = [1, "hello", [3, 4]];
    const html = buildAfHtml("ds:1", data);
    const result = extractAfData(html, "ds:1");
    expect(result).toEqual(data);
  });

  it("extracts nested object data", () => {
    const data = { nested: { key: "value" } };
    const html = buildAfHtml("ds:2", data);
    const result = extractAfData(html, "ds:2");
    expect(result).toEqual(data);
  });

  it("returns null when key is not found", () => {
    const html = buildAfHtml("ds:1", [1, 2]);
    const result = extractAfData(html, "ds:99");
    expect(result).toBeNull();
  });

  it("returns null for empty HTML", () => {
    const result = extractAfData("", "ds:1");
    expect(result).toBeNull();
  });

  it("returns null when data prefix is missing after key", () => {
    const html = `<script>AF_initDataCallback({key: 'ds:1', hash: '1'});</script>`;
    const result = extractAfData(html, "ds:1");
    expect(result).toBeNull();
  });

  it("handles strings with escaped quotes in data", () => {
    const data = ["string with \"quotes\"", "normal"];
    const html = buildAfHtml("ds:1", data);
    const result = extractAfData(html, "ds:1");
    expect(result).toEqual(data);
  });

  it("handles multiple AF_initDataCallback blocks", () => {
    const html = [
      buildAfHtml("ds:0", [0, "zero"]),
      buildAfHtml("ds:1", [1, "one"]),
      buildAfHtml("ds:2", [2, "two"]),
    ].join("");
    expect(extractAfData(html, "ds:0")).toEqual([0, "zero"]);
    expect(extractAfData(html, "ds:1")).toEqual([1, "one"]);
    expect(extractAfData(html, "ds:2")).toEqual([2, "two"]);
  });

  it("returns null for unbalanced brackets", () => {
    const html = `<script>AF_initDataCallback({key: 'ds:1', hash: '1', data:[1,2,3, sideChannel: {}});</script>`;
    const result = extractAfData(html, "ds:1");
    // The bracket-tracking parser will fail to balance, returning null
    expect(result).toBeNull();
  });
});

// ── parseAppEntry ────────────────────────────────────────────────────────

describe("parseAppEntry", () => {
  it("parses a complete 35-field app entry", () => {
    const raw = buildRawAppEntry();
    const result = parseAppEntry(raw);

    expect(result).not.toBeNull();
    expect(result!.appId).toBe(123456789);
    expect(result!.name).toBe("Test App");
    expect(result!.shortDescription).toBe("A short description");
    expect(result!.detailedDescription).toBe("A detailed description of the app");
    expect(result!.iconUrl).toBe("https://lh3.googleusercontent.com/icon.png");
    expect(result!.bannerUrl).toBe("https://lh3.googleusercontent.com/banner.png");
    expect(result!.slug).toBe("test-app");
    expect(result!.developerName).toBe("Test Dev Co");
    expect(result!.developerWebsite).toBe("https://testdev.com");
    expect(result!.developerAddress).toBe("123 Dev Street");
    expect(result!.reviewCount).toBe(42);
    expect(result!.rating).toBe(4.5);
    expect(result!.installCountDisplay).toBe("10,000+");
    expect(result!.installCountExact).toBe(10000);
    expect(result!.termsOfServiceUrl).toBe("https://testdev.com/tos");
    expect(result!.privacyPolicyUrl).toBe("https://testdev.com/privacy");
    expect(result!.supportUrl).toBe("https://testdev.com/support");
    expect(result!.homepageUrl).toBe("https://testdev.com");
    expect(result!.pricing).toEqual([{ code: 4, label: "Free" }]);
    expect(result!.worksWithCodes).toEqual([5, 6]);
    expect(result!.lastUpdatedTimestamp).toBe(1700000000);
  });

  it("returns null for non-array input", () => {
    expect(parseAppEntry("not an array" as unknown as unknown[])).toBeNull();
  });

  it("returns null for arrays shorter than 15 elements", () => {
    expect(parseAppEntry([1, 2, 3])).toBeNull();
    expect(parseAppEntry(new Array(14).fill(null))).toBeNull();
  });

  it("handles missing info (entry[3]) gracefully", () => {
    const raw = buildRawAppEntry();
    raw[3] = null;
    const result = parseAppEntry(raw);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("");
    expect(result!.shortDescription).toBe("");
    expect(result!.iconUrl).toBe("");
    expect(result!.slug).toBe("");
  });

  it("handles missing developer info (entry[4]) gracefully", () => {
    const raw = buildRawAppEntry();
    raw[4] = null;
    const result = parseAppEntry(raw);
    expect(result).not.toBeNull();
    expect(result!.developerName).toBe("");
    expect(result!.developerWebsite).toBe("");
  });

  it("handles missing stats (entry[5]) gracefully", () => {
    const raw = buildRawAppEntry();
    raw[5] = null;
    const result = parseAppEntry(raw);
    expect(result).not.toBeNull();
    expect(result!.reviewCount).toBe(0);
    expect(result!.rating).toBe(0);
    expect(result!.installCountExact).toBeNull();
  });

  it("handles null installCountExact as null", () => {
    const raw = buildRawAppEntry({ installCountExact: null });
    // Force stats array with non-numeric value at index 3
    (raw[5] as unknown[])[3] = null;
    const result = parseAppEntry(raw);
    expect(result!.installCountExact).toBeNull();
  });

  it("handles missing pricing (entry[15]) gracefully", () => {
    const raw = buildRawAppEntry();
    raw[15] = null;
    const result = parseAppEntry(raw);
    expect(result).not.toBeNull();
    expect(result!.pricing).toEqual([]);
  });

  it("handles missing worksWithCodes (entry[12]) gracefully", () => {
    const raw = buildRawAppEntry();
    raw[12] = null;
    const result = parseAppEntry(raw);
    expect(result).not.toBeNull();
    expect(result!.worksWithCodes).toEqual([]);
  });

  it("handles missing timestamp (entry[21]) gracefully", () => {
    const raw = buildRawAppEntry();
    raw[21] = null;
    const result = parseAppEntry(raw);
    expect(result).not.toBeNull();
    expect(result!.lastUpdatedTimestamp).toBeNull();
  });

  it("parses multiple pricing codes", () => {
    const raw = buildRawAppEntry({ pricingRaw: [[4, "Free"], [8, "Paid"]] });
    const result = parseAppEntry(raw);
    expect(result!.pricing).toEqual([
      { code: 4, label: "Free" },
      { code: 8, label: "Paid" },
    ]);
  });
});

// ── extractAppEntries ────────────────────────────────────────────────────

describe("extractAppEntries", () => {
  it("extracts entries from category format: [count, [entries]]", () => {
    const entry1 = buildRawAppEntry({ appId: 111, name: "App One" });
    const entry2 = buildRawAppEntry({ appId: 222, name: "App Two" });
    const ds1 = [2, [[entry1], [entry2]]]; // category format: [count, [[entry1], [entry2]]]

    const results = extractAppEntries(ds1);
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("App One");
    expect(results[1].name).toBe("App Two");
  });

  it("extracts entries from search format: [[[count, [entries]]]]", () => {
    const entry1 = buildRawAppEntry({ appId: 333, name: "Search App" });
    const ds1 = [[[3, [[entry1]]]]]; // search format: [[[count, entries]]]

    const results = extractAppEntries(ds1);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Search App");
  });

  it("extracts single entry from app detail format: [35-fields]", () => {
    const entry = buildRawAppEntry({ appId: 999999999, name: "Detail App" });
    const results = extractAppEntries(entry);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Detail App");
  });

  it("returns empty array for non-array input", () => {
    expect(extractAppEntries(null)).toEqual([]);
    expect(extractAppEntries("string")).toEqual([]);
    expect(extractAppEntries(42)).toEqual([]);
  });

  it("returns empty array for unrecognized array format", () => {
    expect(extractAppEntries(["random", "strings"])).toEqual([]);
    expect(extractAppEntries([1, 2, 3])).toEqual([]);
  });

  it("skips invalid entries in the list", () => {
    const validEntry = buildRawAppEntry({ appId: 444, name: "Valid" });
    const ds1 = [2, [[validEntry], null, "invalid", []]];

    const results = extractAppEntries(ds1);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Valid");
  });

  it("returns empty array for empty categories", () => {
    const ds1 = [0, []];
    const results = extractAppEntries(ds1);
    expect(results).toEqual([]);
  });
});

// ── extractReviewEntries ─────────────────────────────────────────────────

describe("extractReviewEntries", () => {
  function buildDs6(reviews: unknown[][]): unknown[] {
    // ds:6 format: [appId, null, null, totalCount, [[review1], [review2], ...]]
    return [123456789, null, null, reviews.length, reviews];
  }

  function buildReview(overrides: Partial<{
    appId: number;
    authorId: string;
    rating: number;
    content: string;
    timestampMs: number;
    authorName: string;
    authorAvatarUrl: string;
  }> = {}): unknown[][] {
    const o = {
      appId: 123456789,
      authorId: "user123",
      rating: 5,
      content: "Great app!",
      timestampMs: 1700000000000,
      authorName: "John Doe",
      authorAvatarUrl: "https://lh3.googleusercontent.com/avatar.jpg",
      ...overrides,
    };
    // Review format: [[[appId, authorId], rating, content, timestampMs, ?, null, [authorName, avatarUrl], ...]]
    return [[[o.appId, o.authorId], o.rating, o.content, o.timestampMs, null, null, [o.authorName, o.authorAvatarUrl]]];
  }

  it("extracts reviews from ds:6 data", () => {
    const ds6 = buildDs6([buildReview(), buildReview({ authorId: "user456", rating: 3, content: "OK" })]);
    const results = extractReviewEntries(ds6);

    expect(results).toHaveLength(2);
    expect(results[0].appId).toBe(123456789);
    expect(results[0].authorId).toBe("user123");
    expect(results[0].rating).toBe(5);
    expect(results[0].content).toBe("Great app!");
    expect(results[0].authorName).toBe("John Doe");
    expect(results[0].authorAvatarUrl).toBe("https://lh3.googleusercontent.com/avatar.jpg");
    expect(results[1].rating).toBe(3);
    expect(results[1].content).toBe("OK");
  });

  it("returns empty array for non-array input", () => {
    expect(extractReviewEntries(null)).toEqual([]);
    expect(extractReviewEntries("string")).toEqual([]);
  });

  it("returns empty array when ds6 has fewer than 5 elements", () => {
    expect(extractReviewEntries([1, 2, 3])).toEqual([]);
  });

  it("returns empty array when reviews array is not present", () => {
    expect(extractReviewEntries([1, null, null, 0, null])).toEqual([]);
  });

  it("skips invalid review entries", () => {
    const valid = buildReview({ authorName: "Valid User" });
    const ds6 = buildDs6([valid, [null], ["too short"], []]);
    const results = extractReviewEntries(ds6);

    expect(results).toHaveLength(1);
    expect(results[0].authorName).toBe("Valid User");
  });

  it("handles missing author info gracefully", () => {
    const review: unknown[][] = [[[123, "anon"], 4, "No avatar", 1700000000000, null, null, []]];
    const ds6 = buildDs6([review]);
    const results = extractReviewEntries(ds6);

    expect(results).toHaveLength(1);
    expect(results[0].authorName).toBe("Anonymous");
    expect(results[0].authorAvatarUrl).toBe("");
  });

  it("handles empty reviews array", () => {
    const ds6 = buildDs6([]);
    const results = extractReviewEntries(ds6);
    expect(results).toEqual([]);
  });
});

// ── normalizePricingFromCodes ────────────────────────────────────────────

describe("normalizePricingFromCodes", () => {
  it("returns free for code 4 only", () => {
    const result = normalizePricingFromCodes([{ code: 4, label: "Free" }]);
    expect(result).toEqual({ hint: "Free", model: "free" });
  });

  it("returns freemium for code 4 plus other codes", () => {
    const result = normalizePricingFromCodes([{ code: 4, label: "Free" }, { code: 8, label: "Paid" }]);
    expect(result).toEqual({ hint: "Free with paid features", model: "freemium" });
  });

  it("returns paid for code 8 only", () => {
    const result = normalizePricingFromCodes([{ code: 8, label: "Paid" }]);
    expect(result).toEqual({ hint: "Paid", model: "paid" });
  });

  it("returns unknown for empty pricing", () => {
    const result = normalizePricingFromCodes([]);
    expect(result).toEqual({ hint: "", model: "unknown" });
  });

  it("returns unknown for unrecognized codes", () => {
    const result = normalizePricingFromCodes([{ code: 99, label: "Custom" }]);
    expect(result).toEqual({ hint: "", model: "unknown" });
  });
});

// ── mapWorksWithCodes ────────────────────────────────────────────────────

describe("mapWorksWithCodes", () => {
  it("maps known codes to product names", () => {
    const result = mapWorksWithCodes([5, 6, 13]);
    expect(result).toEqual(["Google Sheets", "Google Docs", "Gmail"]);
  });

  it("deduplicates product names (codes 8 and 9 both map to Google Slides)", () => {
    const result = mapWorksWithCodes([8, 9]);
    // Code 8 maps to "Google Slides", code 9 also maps to "Google Slides"
    // But code 8 actually maps to "Google Slides" (standalone) — both deduplicated
    expect(result).toContain("Google Slides");
  });

  it("skips unknown codes", () => {
    const result = mapWorksWithCodes([5, 999, 6]);
    expect(result).toEqual(["Google Sheets", "Google Docs"]);
  });

  it("returns empty array for empty codes", () => {
    expect(mapWorksWithCodes([])).toEqual([]);
  });

  it("maps all known codes correctly", () => {
    const allCodes = [2, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 17];
    const result = mapWorksWithCodes(allCodes);
    expect(result).toContain("Google Drive");
    expect(result).toContain("Google Sheets");
    expect(result).toContain("Google Docs");
    expect(result).toContain("Google Forms");
    expect(result).toContain("Google Slides");
    expect(result).toContain("Google Calendar");
    expect(result).toContain("Google Meet");
    expect(result).toContain("Gmail");
    expect(result).toContain("Google Chat");
    expect(result).toContain("Google Classroom");
    expect(result).toContain("Google Groups");
  });
});
