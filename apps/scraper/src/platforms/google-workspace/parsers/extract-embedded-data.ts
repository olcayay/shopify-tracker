/**
 * Extract structured data from Google Workspace Marketplace's AF_initDataCallback scripts.
 *
 * Google embeds JSON data in <script> tags using:
 *   AF_initDataCallback({key: 'ds:N', hash: 'X', data: [...], sideChannel: {}});
 *
 * This is far more reliable than scraping obfuscated CSS class names.
 */

/**
 * Structured app entry from the embedded JSON (35 fields).
 * Same format used on detail, category, and search pages.
 */
export interface GWorkspaceAppEntry {
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
  pricing: GWorkspacePricing[];
  /** Works-with app type codes (e.g., 2=Drive, 5=Sheets, 6=Docs, 9=Slides, 10=Calendar, 11=Meet) */
  worksWithCodes: number[];
  /** Unix timestamp seconds of last update */
  lastUpdatedTimestamp: number | null;
}

export interface GWorkspacePricing {
  code: number;
  label: string;
}

/**
 * Review entry from ds:6 embedded data.
 */
export interface GWorkspaceReviewEntry {
  appId: number;
  authorId: string;
  rating: number;
  content: string;
  timestampMs: number;
  authorName: string;
  authorAvatarUrl: string;
}

/**
 * Extract a specific AF_initDataCallback dataset from HTML.
 * @param html Full page HTML
 * @param key Dataset key (e.g., "ds:1", "ds:6")
 * @returns Parsed JSON data or null if not found
 */
export function extractAfData(html: string, key: string): unknown | null {
  // Find the AF_initDataCallback for this key
  const keyPattern = `AF_initDataCallback({key: '${key}',`;
  const keyIdx = html.indexOf(keyPattern);
  if (keyIdx === -1) return null;

  // Find "data:" after the key
  const dataPrefix = "data:";
  const dataIdx = html.indexOf(dataPrefix, keyIdx);
  if (dataIdx === -1) return null;

  const startIdx = dataIdx + dataPrefix.length;

  // Find the end of the data value by tracking bracket depth
  let depth = 0;
  let i = startIdx;
  let inString = false;
  let escape = false;

  while (i < html.length) {
    const c = html[i];
    if (escape) {
      escape = false;
      i++;
      continue;
    }
    if (c === "\\") {
      escape = true;
      i++;
      continue;
    }
    if (c === '"') {
      inString = !inString;
    } else if (!inString) {
      if (c === "[" || c === "{") {
        depth++;
      } else if (c === "]" || c === "}") {
        depth--;
        if (depth === 0) {
          break;
        }
      }
    }
    i++;
  }

  if (depth !== 0) return null;

  const jsonStr = html.slice(startIdx, i + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Parse a 35-field app entry array into a structured object.
 */
export function parseAppEntry(entry: unknown[]): GWorkspaceAppEntry | null {
  if (!Array.isArray(entry) || entry.length < 15) return null;

  const info = entry[3] as unknown[] | null;
  const dev = entry[4] as unknown[] | null;
  const stats = entry[5] as unknown[] | null;
  const urls = entry[8] as unknown[] | null;
  const pricingRaw = entry[15] as unknown[][] | null;
  const worksWithRaw = entry[12] as number[] | null;
  const timestampRaw = entry[21] as number[] | null;

  return {
    appId: (entry[0] as number) || 0,
    name: info?.[0] as string || "",
    shortDescription: info?.[1] as string || "",
    detailedDescription: info?.[2] as string || "",
    iconUrl: info?.[3] as string || "",
    bannerUrl: info?.[4] as string || "",
    slug: info?.[5] as string || "",
    developerName: dev?.[0] as string || "",
    developerWebsite: dev?.[1] as string || "",
    developerAddress: dev?.[3] as string || "",
    reviewCount: (stats?.[0] as number) || 0,
    rating: (stats?.[1] as number) || 0,
    installCountDisplay: stats?.[2] as string || "",
    installCountExact: typeof stats?.[3] === "number" ? stats[3] : null,
    termsOfServiceUrl: urls?.[1] as string || "",
    privacyPolicyUrl: urls?.[2] as string || "",
    supportUrl: urls?.[3] as string || "",
    homepageUrl: urls?.[4] as string || "",
    pricing: Array.isArray(pricingRaw) ? pricingRaw.map(p => ({ code: p[0] as number, label: p[1] as string })) : [],
    worksWithCodes: Array.isArray(worksWithRaw) ? worksWithRaw : [],
    lastUpdatedTimestamp: timestampRaw?.[0] as number || null,
  };
}

/**
 * Extract app entries from a category or search page's ds:1 data.
 *
 * Category format: [count, [entries]] where each entry is [[35-fields]]
 * Search format: [[[count, [entries]]]] where each entry is [[35-fields]]
 */
export function extractAppEntries(ds1Data: unknown): GWorkspaceAppEntry[] {
  if (!Array.isArray(ds1Data)) return [];

  // Try category format: [count, entries_array]
  if (ds1Data.length === 2 && typeof ds1Data[0] === "number" && Array.isArray(ds1Data[1])) {
    return parseEntryList(ds1Data[1]);
  }

  // Try search format: [[[count, entries_array]]]
  if (ds1Data.length >= 1 && Array.isArray(ds1Data[0])) {
    const inner = ds1Data[0];
    if (Array.isArray(inner) && inner.length >= 1 && Array.isArray(inner[0])) {
      const innermost = inner[0];
      if (innermost.length === 2 && typeof innermost[0] === "number" && Array.isArray(innermost[1])) {
        return parseEntryList(innermost[1]);
      }
    }
  }

  // Try app detail format: [35-field-entry] (single entry wrapped in array)
  if (ds1Data.length >= 15 && typeof ds1Data[0] === "number" && ds1Data[0] > 100000000) {
    const entry = parseAppEntry(ds1Data);
    return entry ? [entry] : [];
  }

  return [];
}

function parseEntryList(entries: unknown[]): GWorkspaceAppEntry[] {
  const results: GWorkspaceAppEntry[] = [];
  for (const wrapper of entries) {
    if (!Array.isArray(wrapper) || wrapper.length === 0) continue;
    const raw = wrapper[0]; // [[35-fields]] → [35-fields]
    if (!Array.isArray(raw)) continue;
    const entry = parseAppEntry(raw);
    if (entry) results.push(entry);
  }
  return results;
}

/**
 * Extract review entries from ds:6 data.
 *
 * Format: [appId, null, null, totalCount, [[review1], [review2], ...]]
 * Each review: [[[appId, authorId], rating, content, timestampMs, ?, null, [authorName, avatarUrl], ...]]
 */
export function extractReviewEntries(ds6Data: unknown): GWorkspaceReviewEntry[] {
  if (!Array.isArray(ds6Data) || ds6Data.length < 5) return [];

  const reviewsArray = ds6Data[4];
  if (!Array.isArray(reviewsArray)) return [];

  const results: GWorkspaceReviewEntry[] = [];
  for (const wrapper of reviewsArray) {
    if (!Array.isArray(wrapper) || wrapper.length === 0) continue;
    const review = wrapper[0];
    if (!Array.isArray(review) || review.length < 7) continue;

    const ids = review[0] as unknown[];
    const authorInfo = review[6] as unknown[];

    results.push({
      appId: (ids?.[0] as number) || 0,
      authorId: String(ids?.[1] || ""),
      rating: (review[1] as number) || 0,
      content: (review[2] as string) || "",
      timestampMs: (review[3] as number) || 0,
      authorName: (authorInfo?.[0] as string) || "Anonymous",
      authorAvatarUrl: (authorInfo?.[1] as string) || "",
    });
  }

  return results;
}

/**
 * Map Google Workspace pricing codes to human-readable strings.
 */
export function normalizePricingFromCodes(pricing: GWorkspacePricing[]): { hint: string; model: string } {
  // Known codes from observation: 4 = free, 8 = paid (needs verification with more samples)
  const codes = pricing.map(p => p.code);

  // Multiple pricing codes can indicate "Free with paid features"
  if (codes.includes(4) && codes.length > 1) {
    return { hint: "Free with paid features", model: "freemium" };
  }
  if (codes.includes(4)) {
    return { hint: "Free", model: "free" };
  }
  if (codes.includes(8)) {
    return { hint: "Paid", model: "paid" };
  }

  return { hint: "", model: "unknown" };
}

/**
 * Map "works with" numeric codes to product names.
 * Based on observed patterns from the marketplace.
 */
const WORKS_WITH_MAP: Record<number, string> = {
  2: "Google Drive",
  5: "Google Sheets",
  6: "Google Docs",
  7: "Google Forms",
  8: "Google Slides", // standalone app type, also maps to Slides
  9: "Google Slides",
  10: "Google Calendar",
  11: "Google Meet",
  13: "Gmail",
  14: "Google Chat",
  15: "Google Classroom",
  17: "Google Groups",
};

export function mapWorksWithCodes(codes: number[]): string[] {
  const products = new Set<string>();
  for (const code of codes) {
    const name = WORKS_WITH_MAP[code];
    if (name) products.add(name);
  }
  return [...products];
}
