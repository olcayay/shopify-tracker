import { createLogger } from "@appranks/shared";
import type { NormalizedAppDetails } from "../../platform-module.js";

const log = createLogger("canva-app-parser");

/**
 * Canva embedded app data structure.
 *
 * The /apps page embeds all app data in inline JSON with this minified schema:
 *   "A": app ID (e.g. "AAF_8lkU9VE")
 *   "B": type (always "SDK_APP")
 *   "C": display name
 *   "D": short description
 *   "E": tagline
 *   "F": developer name
 *   "G": { "A": icon URL, "B": width, "C": height }
 *   "H": full description (may be empty)
 *   "I": topic tags array (e.g. ["marketplace_topic.ai_audio", ...])
 */
export interface CanvaEmbeddedApp {
  id: string;
  name: string;
  shortDescription: string;
  tagline: string;
  developer: string;
  iconUrl: string;
  fullDescription: string;
  topics: string[];
  urlSlug: string;
}

/**
 * Extract all apps from the Canva /apps page HTML.
 *
 * Finds each JSON object starting with {"A":"AA...","B":"SDK_APP",...}
 * and parses it as JSON for reliable field extraction.
 */
export function extractCanvaApps(html: string): CanvaEmbeddedApp[] {
  const apps: CanvaEmbeddedApp[] = [];
  const seen = new Set<string>();

  // Find each SDK_APP entry by locating the start pattern, then extracting the full JSON object
  const startPattern = /\{"A":"(AA[FG][^"]+)","B":"SDK_APP"/g;

  let match;
  while ((match = startPattern.exec(html)) !== null) {
    const id = match[1];
    if (seen.has(id)) continue;

    // Extract the full JSON object by tracking brace depth
    const objStart = match.index;
    let depth = 0;
    let objEnd = objStart;
    for (let i = objStart; i < html.length && i < objStart + 3000; i++) {
      if (html[i] === "{") depth++;
      if (html[i] === "}") {
        depth--;
        if (depth === 0) { objEnd = i + 1; break; }
      }
    }

    if (objEnd <= objStart) continue;

    try {
      const obj = JSON.parse(html.substring(objStart, objEnd));
      seen.add(id);

      const topics = (obj.I || []).filter((t: string) => t.startsWith("marketplace_topic."));

      // Derive URL slug from app links in the page
      const slugMatch = html.match(new RegExp(`/apps/${id}/([a-z0-9-]+)`));
      const name = obj.C || "";
      const urlSlug = slugMatch ? slugMatch[1] : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      apps.push({
        id,
        name,
        shortDescription: obj.D || "",
        tagline: obj.E || "",
        developer: obj.F || "",
        iconUrl: obj.G?.A || "",
        fullDescription: typeof obj.H === "string" ? obj.H : "",
        topics,
        urlSlug,
      });
    } catch {
      // JSON parse failed — skip this entry
      log.warn("failed to parse canva app entry", { id });
    }
  }

  log.info("extracted canva apps from embedded JSON", { count: apps.length });
  return apps;
}

/**
 * Convert a CanvaEmbeddedApp into NormalizedAppDetails.
 */
export function normalizeCanvaApp(app: CanvaEmbeddedApp): NormalizedAppDetails {
  // Build the slug: "AAF_8lkU9VE--ai-music" (using -- instead of / for URL safety)
  const slug = app.urlSlug ? `${app.id}--${app.urlSlug}` : app.id;

  return {
    name: app.name,
    slug,
    averageRating: null,  // Canva has no ratings
    ratingCount: null,     // Canva has no reviews
    pricingHint: null,     // Limited pricing info
    iconUrl: app.iconUrl || null,
    developer: app.developer
      ? { name: app.developer }
      : null,
    badges: [],
    platformData: {
      canvaAppId: app.id,
      shortDescription: app.shortDescription,
      tagline: app.tagline,
      fullDescription: app.fullDescription,
      topics: app.topics,
      urlSlug: app.urlSlug,
    },
  };
}

/**
 * Parse a single app from HTML (used when we have the full page HTML).
 * For Canva, we extract from the embedded JSON, not from a separate app page.
 */
export function parseCanvaAppPage(html: string, slug: string): NormalizedAppDetails {
  // The slug might be "AAF_8lkU9VE--ai-music" or just "AAF_8lkU9VE"
  const appId = slug.split("--")[0];

  const apps = extractCanvaApps(html);
  const app = apps.find((a) => a.id === appId);

  if (!app) {
    log.warn("app not found in embedded JSON", { slug, appId, totalApps: apps.length });
    return fallback(slug);
  }

  return normalizeCanvaApp(app);
}

function fallback(slug: string): NormalizedAppDetails {
  const appId = slug.split("--")[0];
  log.info("app parsed with minimal data (fallback)", { slug });
  return {
    name: slug.split("--")[1]?.replace(/-/g, " ") || appId,
    slug,
    averageRating: null,
    ratingCount: null,
    pricingHint: null,
    iconUrl: null,
    developer: null,
    badges: [],
    platformData: { canvaAppId: appId },
  };
}
