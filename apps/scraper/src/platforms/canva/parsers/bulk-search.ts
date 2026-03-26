import { extractCanvaApps, type CanvaEmbeddedApp } from "./app-parser.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("canva-bulk-search");

/**
 * Client-side text search over Canva's bulk /apps page data.
 * Used as fallback when the Canva search API (via browser interception) fails.
 *
 * Extracts all ~1000 apps from the embedded JSON and performs text matching
 * on name, short description, tagline, and topic tags.
 *
 * Returns a JSON string matching the Canva search API format: { A: count, C: apps[] }
 */
export function searchBulkApps(html: string, keyword: string): string {
  const allApps = extractCanvaApps(html);
  const terms = keyword.toLowerCase().split(/\s+/).filter(Boolean);

  const matches: CanvaEmbeddedApp[] = [];

  for (const app of allApps) {
    const haystack = [
      app.name,
      app.shortDescription,
      app.tagline,
      app.developer,
      ...app.topics,
    ]
      .join(" ")
      .toLowerCase();

    const score = terms.reduce(
      (acc, term) => acc + (haystack.includes(term) ? 1 : 0),
      0,
    );

    if (score === terms.length) {
      // All terms matched
      matches.push(app);
    }
  }

  log.info("bulk search complete", { keyword, allApps: allApps.length, matches: matches.length });

  // Convert to Canva search API format
  const results = matches.map((app) => ({
    A: app.id,
    B: app.appType,
    C: app.name,
    D: app.shortDescription,
    E: app.tagline,
    F: app.developer,
    G: { A: app.iconUrl },
    I: app.topics,
  }));

  return JSON.stringify({ A: matches.length, C: results });
}
