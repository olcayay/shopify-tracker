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
 *   "G": { "A": icon URL }
 *   "H": full description
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
 * Uses regex to find the minified JSON entries embedded in the page.
 */
export function extractCanvaApps(html: string): CanvaEmbeddedApp[] {
  const apps: CanvaEmbeddedApp[] = [];
  const seen = new Set<string>();

  // Pattern: "A":"AAxxxx","B":"SDK_APP","C":"Name","D":"Desc","E":"Tagline","F":"Dev","G":{"A":"iconUrl"},"H":"FullDesc","I":[topics]
  // The full pattern with all fields
  const fullPattern =
    /"A":"(AA[FG][^"]+)","B":"SDK_APP","C":"([^"]+)","D":"([^"]*)","E":"([^"]*)","F":"([^"]*)","G":\{"A":"([^"]*)"\},"H":"([^"]*)","I":\[([^\]]*)\]/g;

  let match;
  while ((match = fullPattern.exec(html)) !== null) {
    const [, id, name, shortDesc, tagline, developer, iconUrl, fullDesc, topicsRaw] = match;
    if (seen.has(id)) continue;
    seen.add(id);

    const topics = topicsRaw
      ? topicsRaw
          .replace(/"/g, "")
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.startsWith("marketplace_topic."))
      : [];

    // Derive URL slug from app links in the page
    const slugMatch = html.match(new RegExp(`/apps/${id}/([a-z0-9-]+)`));
    const urlSlug = slugMatch ? slugMatch[1] : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    apps.push({
      id,
      name: unescapeJson(name),
      shortDescription: unescapeJson(shortDesc),
      tagline: unescapeJson(tagline),
      developer: unescapeJson(developer),
      iconUrl,
      fullDescription: unescapeJson(fullDesc),
      topics,
      urlSlug,
    });
  }

  // Fallback: simpler pattern for apps that may have different field ordering
  const simplePattern =
    /"A":"(AA[FG][^"]+)","B":"SDK_APP","C":"([^"]+)","D":"([^"]*)","E":"([^"]*)","F":"([^"]*)"/g;

  while ((match = simplePattern.exec(html)) !== null) {
    const [, id, name, shortDesc, tagline, developer] = match;
    if (seen.has(id)) continue;
    seen.add(id);

    // Try to extract icon and topics nearby in the HTML
    const iconMatch = html.substring(match.index, match.index + 2000).match(/"G":\{"A":"([^"]*)"\}/);
    const topicsMatch = html.substring(match.index, match.index + 2000).match(/"I":\[([^\]]*)\]/);
    const descMatch = html.substring(match.index, match.index + 2000).match(/"H":"([^"]*)"/);

    const topics = topicsMatch
      ? topicsMatch[1]
          .replace(/"/g, "")
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.startsWith("marketplace_topic."))
      : [];

    const slugMatch = html.match(new RegExp(`/apps/${id}/([a-z0-9-]+)`));
    const urlSlug = slugMatch ? slugMatch[1] : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    apps.push({
      id,
      name: unescapeJson(name),
      shortDescription: unescapeJson(shortDesc),
      tagline: unescapeJson(tagline),
      developer: unescapeJson(developer),
      iconUrl: iconMatch ? iconMatch[1] : "",
      fullDescription: descMatch ? unescapeJson(descMatch[1]) : "",
      topics,
      urlSlug,
    });
  }

  log.info("extracted canva apps from embedded JSON", { count: apps.length });
  return apps;
}

/** Unescape JSON string escape sequences */
function unescapeJson(s: string): string {
  return s
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\\\/g, "\\");
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
