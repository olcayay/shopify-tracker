import { createLogger } from "@appranks/shared";
import type { NormalizedAppDetails } from "../../platform-module.js";

const log = createLogger("canva-app-parser");

/**
 * Canva embedded app data structure (from /apps bulk page).
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
  appType: string;
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
 * Canva app detail page data structure (from individual app pages).
 *
 * Detail pages embed a richer JSON with this schema:
 *   "A": app ID
 *   "C": developer name
 *   "E": display name (app name)
 *   "F": short description (meta)
 *   "G": tagline (H1 heading)
 *   "H": full description
 *   "I"/"J": promo card image URL
 *   "K": thumbnail URL (128x128)
 *   "L": terms URL
 *   "M": privacy policy URL
 *   "N": developer website URL
 *   "O": screenshots array (URLs)
 *   "R": number (version/count)
 *   "V": permissions array [{A: scope, B: "MANDATORY"|"OPTIONAL"}]
 *   "W": boolean (published)
 *   "X": developer info {A: name, B: email, C: phone, D: address, E: devId}
 *   "Y": languages array (locale codes)
 */
export interface CanvaDetailApp {
  id: string;
  name: string;
  shortDescription: string;
  tagline: string;
  fullDescription: string;
  developer: string;
  developerWebsite: string;
  developerEmail: string;
  developerPhone: string;
  developerAddress: {
    street: string;
    city: string;
    country: string;
    state: string;
    zip: string;
  } | null;
  iconUrl: string;
  promoCardUrl: string;
  screenshots: string[];
  termsUrl: string;
  privacyUrl: string;
  permissions: { scope: string; type: string }[];
  languages: string[];
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

  // Match both SDK_APP and EXTENSION entries, with any AA-prefix ID
  const startPattern = /\{"A":"(AA[A-Za-z][^"]+)","B":"(?:SDK_APP|EXTENSION)"/g;

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
      // Fix non-standard hex escapes (\x3c → \u003c) before parsing
      const rawJson = html.substring(objStart, objEnd).replace(
        /\\x([0-9a-fA-F]{2})/g,
        (_, hex) => `\\u00${hex}`,
      );
      const obj = JSON.parse(rawJson);
      seen.add(id);

      const topics = (obj.I || []).filter((t: string) => t.startsWith("marketplace_topic."));

      // Derive URL slug from app links in the page
      const slugMatch = html.match(new RegExp(`/apps/${id}/([a-z0-9-]+)`));
      const name = obj.C || "";
      const urlSlug = slugMatch ? slugMatch[1] : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      apps.push({
        id,
        appType: obj.B || "SDK_APP",
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
 * Extract app detail data from a rendered Canva app detail page.
 *
 * Detail pages embed a JSON object with schema different from the /apps page.
 * We find it by matching the app ID pattern without the "SDK_APP" marker.
 */
export function extractCanvaDetailApp(html: string, appId: string): CanvaDetailApp | null {
  // The detail page JSON contains the app ID as "A":"<appId>" plus detail-specific keys.
  // Try multiple patterns: keys may appear in different orders across Canva versions.
  // The bulk page format has "B":"SDK_APP" which we must NOT match here.
  const eid = escapeRegex(appId);
  const patterns = [
    new RegExp(`\\{"A":"${eid}","C":"[^"]+","E":"`),    // original: A,C,E order
    new RegExp(`\\{"A":"${eid}","(?!B":"(?:SDK_APP|EXTENSION))[A-Z]":"`), // A + any key except B:SDK_APP
  ];
  let match: RegExpExecArray | null = null;
  for (const p of patterns) {
    match = p.exec(html);
    if (match) break;
  }

  if (!match) {
    log.warn("detail JSON not found in page", { appId });
    return null;
  }

  // Extract the full JSON object by tracking brace depth
  const objStart = match.index;
  let depth = 0;
  let objEnd = objStart;
  for (let i = objStart; i < html.length && i < objStart + 20000; i++) {
    if (html[i] === "{") depth++;
    if (html[i] === "}") {
      depth--;
      if (depth === 0) { objEnd = i + 1; break; }
    }
  }

  if (objEnd <= objStart) {
    log.warn("failed to extract detail JSON bounds", { appId });
    return null;
  }

  try {
    const obj = JSON.parse(html.substring(objStart, objEnd));

    // Validate this is actually a detail object (must have E=name, not just a URL reference)
    if (!obj.E || typeof obj.E !== "string") {
      log.warn("matched JSON lacks expected detail fields", { appId });
      return null;
    }

    const devInfo = obj.X || {};
    const address = devInfo.D
      ? {
          street: devInfo.D.A || "",
          city: devInfo.D.C || "",
          country: devInfo.D.D || "",
          state: devInfo.D.E || "",
          zip: devInfo.D.F || "",
        }
      : null;

    return {
      id: obj.A || appId,
      name: obj.E || "",
      shortDescription: obj.F || "",
      tagline: obj.G || "",
      fullDescription: obj.H || "",
      developer: obj.C || devInfo.A || "",
      developerWebsite: obj.N || "",
      developerEmail: devInfo.B || "",
      developerPhone: devInfo.C || "",
      developerAddress: address,
      iconUrl: obj.K || "",
      promoCardUrl: obj.I || "",
      screenshots: obj.O || [],
      termsUrl: obj.L || "",
      privacyUrl: obj.M || "",
      permissions: (obj.V || []).map((p: any) => ({
        scope: p.A || "",
        type: p.B || "",
      })),
      languages: obj.Y || [],
    };
  } catch (e) {
    log.warn("failed to parse detail JSON", { appId, error: String(e) });
    return null;
  }
}

/**
 * Convert a CanvaEmbeddedApp into NormalizedAppDetails (from /apps bulk page).
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
    badges: app.appType === "EXTENSION" ? ["canva_extension"] : [],
    platformData: {
      canvaAppId: app.id,
      canvaAppType: app.appType,
      description: app.shortDescription,
      tagline: app.tagline,
      fullDescription: app.fullDescription,
      topics: app.topics,
      urlSlug: app.urlSlug,
    },
  };
}

/**
 * Convert a CanvaDetailApp into NormalizedAppDetails (from detail page).
 */
function normalizeCanvaDetailApp(app: CanvaDetailApp, slug: string): NormalizedAppDetails {
  return {
    name: app.name,
    slug,
    averageRating: null,
    ratingCount: null,
    pricingHint: null,
    iconUrl: app.iconUrl || null,
    developer: app.developer
      ? {
          name: app.developer,
          website: app.developerWebsite || undefined,
          url: app.developerWebsite || undefined,
        }
      : null,
    badges: [],
    platformData: {
      canvaAppId: app.id,
      description: app.shortDescription,
      tagline: app.tagline,
      fullDescription: app.fullDescription,
      screenshots: app.screenshots,
      promoCardUrl: app.promoCardUrl,
      developerEmail: app.developerEmail,
      developerPhone: app.developerPhone,
      developerAddress: app.developerAddress,
      termsUrl: app.termsUrl,
      privacyUrl: app.privacyUrl,
      permissions: app.permissions,
      languages: app.languages,
    },
  };
}

/**
 * Parse a single app from HTML.
 *
 * First tries to parse as a detail page (richer data).
 * Falls back to extracting from /apps bulk page embedded JSON.
 */
export function parseCanvaAppPage(html: string, slug: string): NormalizedAppDetails {
  // The slug might be "AAF_8lkU9VE--ai-music" or just "AAF_8lkU9VE"
  const appId = slug.split("--")[0];

  // Try detail page format first (richer data)
  const detailApp = extractCanvaDetailApp(html, appId);
  if (detailApp) {
    log.info("parsed app from detail page", { appId, name: detailApp.name });
    return normalizeCanvaDetailApp(detailApp, slug);
  }

  // Fall back to bulk /apps page format
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
