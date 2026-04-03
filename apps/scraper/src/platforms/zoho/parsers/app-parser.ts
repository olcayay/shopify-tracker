import * as cheerio from "cheerio";
import { createLogger, safeParseFloat } from "@appranks/shared";
import type { NormalizedAppDetails } from "../../platform-module.js";

const log = createLogger("zoho:app-parser");

/**
 * Extract a JSON object from a string starting at the given `{` position
 * by counting brace depth. Returns the substring including the outer braces.
 */
function extractJsonObject(text: string, startIdx: number): string | null {
  if (text[startIdx] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(startIdx, i + 1);
    }
  }
  return null;
}

/**
 * Parse a Zoho Marketplace app detail page (HTML).
 *
 * The app data is embedded in a `<script>` tag as:
 *   var detailsObject = { ... } ;
 *
 * The object is valid JSON. We extract it via brace-matching (not regex)
 * because the object is large with nested braces.
 *
 * Note: There's also a `detailsObjecti1` with related apps — we need
 * `detailsObject` specifically (word boundary match).
 */
export function parseZohoAppDetails(html: string, slug: string): NormalizedAppDetails {
  const $ = cheerio.load(html);

  let detailsObj: any = null;
  $("script").each((_i, el) => {
    if (detailsObj) return; // already found
    const text = $(el).html() || "";

    // Match "var detailsObject =" but NOT "var detailsObjecti1 ="
    // Use word boundary: detailsObject followed by whitespace or =
    const marker = /var\s+detailsObject\s*=\s*/g;
    let m: RegExpExecArray | null;
    while ((m = marker.exec(text)) !== null) {
      // Make sure this isn't detailsObjecti1, detailsObjecti2, etc.
      // Check what comes before the `=`: the variable name must be exactly "detailsObject"
      const varMatch = m[0].match(/var\s+(\w+)\s*=/);
      if (varMatch && varMatch[1] !== "detailsObject") continue;

      const braceIdx = text.indexOf("{", m.index + m[0].length - 1);
      if (braceIdx === -1) continue;

      const jsonStr = extractJsonObject(text, braceIdx);
      if (!jsonStr) continue;

      try {
        detailsObj = JSON.parse(jsonStr);
        log.info("parsed detailsObject via JSON.parse", { slug, size: jsonStr.length });
      } catch (err) {
        log.warn("failed to parse detailsObject via JSON.parse", { slug, error: String(err), size: jsonStr.length });
      }
      if (detailsObj) break;
    }
  });

  if (detailsObj) {
    return parseFromDetailsObject(detailsObj, slug);
  }

  // Fallback: parse from DOM elements
  log.warn("detailsObject not found, falling back to DOM parsing", { slug });
  return parseFromDom($, slug);
}

function parseFromDetailsObject(obj: any, slug: string): NormalizedAppDetails {
  const ext = obj.extensionDetails || obj;
  const partners = obj.partnerDetails || [];
  const cats = obj.categories || [];

  // Sum individual star counts for total rating count
  const ratingCount =
    (Number(ext.onestar) || 0) +
    (Number(ext.twostar) || 0) +
    (Number(ext.threestar) || 0) +
    (Number(ext.fourstar) || 0) +
    (Number(ext.fivestar) || 0);

  const avgRating = ext.avgrating ? Number(ext.avgrating) : null;

  // Extract category slugs from categories array
  const categorySlugs = cats.map((c: any) => {
    return c.slug || c.categorySlug || c.name?.toLowerCase().replace(/\s+/g, "-");
  }).filter(Boolean);

  const partner = partners[0] || {};

  // Build logo URL — numeric logo IDs use the /view/logo/ path on the CDN
  let iconUrl: string | null = null;
  if (ext.logo) {
    if (typeof ext.logo === "string" && ext.logo.startsWith("/view/")) {
      iconUrl = `https://marketplace.zoho.com${ext.logo}`;
    } else if (typeof ext.logo === "string" && ext.logo.startsWith("http")) {
      iconUrl = ext.logo;
    } else {
      // Numeric logo ID or UUID path
      iconUrl = `https://marketplace.zoho.com/view/extension/${ext.logo}`;
    }
  }

  return {
    name: ext.title || ext.extensionName || slug,
    slug,
    averageRating: avgRating,
    ratingCount: ratingCount || null,
    pricingHint: ext.pricing || null,
    iconUrl,
    developer: partner.companyName
      ? {
          name: partner.companyName,
          url: partner.supportEmail ? `mailto:${partner.supportEmail}` : undefined,
          website: partner.websiteUrl || undefined,
        }
      : null,
    badges: [],
    platformData: {
      extensionId: ext.extensionId
        ? String(ext.extensionId)
        : ext.ext_uuid
          ? String(ext.ext_uuid)
          : undefined,
      namespace: ext.namespace || undefined,
      tagline: ext.tagline || ext.shortDescription || undefined,
      about: ext.about || ext.description || undefined,
      pricing: ext.pricing || undefined,
      publishedDate: ext.publishedDate || undefined,
      version: ext.version || undefined,
      deploymentType: ext.deploymentname || ext.deploymentType || undefined,
      cEdition: ext.cEdition ?? undefined,
      categories: categorySlugs.map((s: string) => ({ slug: s })),
      partnerDetails: partners.map((p: any) => ({
        companyName: p.companyName || null,
        supportEmail: p.supportEmail || null,
        partner_uuid: p.partner_uuid || null,
        websiteUrl: p.websiteUrl || null,
      })),
      versionhistory: obj.versionhistory || undefined,
      ratingBreakdown: {
        onestar: Number(ext.onestar) || 0,
        twostar: Number(ext.twostar) || 0,
        threestar: Number(ext.threestar) || 0,
        fourstar: Number(ext.fourstar) || 0,
        fivestar: Number(ext.fivestar) || 0,
      },
    },
  };
}

function parseFromDom($: cheerio.CheerioAPI, slug: string): NormalizedAppDetails {
  const name = $("h1").first().text().trim() || $(".extension-name").first().text().trim() || slug;
  const tagline = $(".tagline, .short-description").first().text().trim() || undefined;

  const ratingText = $(".rating-value, .avg-rating").first().text().trim();
  const avgRating = safeParseFloat(ratingText);

  const ratingCountText = $(".rating-count, .total-ratings").first().text().trim();
  const ratingCount = ratingCountText ? parseInt(ratingCountText.replace(/[^0-9]/g, ""), 10) : null;

  const iconUrl = $(".extension-icon img, .app-icon img").first().attr("src") || null;
  const developerName = $(".developer-name, .partner-name").first().text().trim() || null;

  return {
    name,
    slug,
    averageRating: avgRating && !isNaN(avgRating) ? avgRating : null,
    ratingCount: ratingCount && !isNaN(ratingCount) ? ratingCount : null,
    pricingHint: null,
    iconUrl,
    developer: developerName ? { name: developerName } : null,
    badges: [],
    platformData: {
      tagline,
      source: "dom-fallback",
    },
  };
}
