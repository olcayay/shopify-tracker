import * as cheerio from "cheerio";
import { createLogger, safeParseFloat, normalizePricingModel } from "@appranks/shared";
import type { NormalizedAppDetails } from "../../platform-module.js";
import {
  extractAfData,
  parseAppEntry,
  mapWorksWithCodes,
  type GWorkspaceAppEntry,
} from "./extract-embedded-data.js";

const log = createLogger("gworkspace-app-parser");

/**
 * Parse Google Workspace Marketplace app detail page.
 *
 * Primary data source: AF_initDataCallback ds:1 (embedded structured JSON)
 * Fallback: DOM selectors with real CSS classes from exploration.
 *
 * ds:1 on app detail page is a single 35-field entry array:
 *   [appId, null, null, [name, shortDesc, detailedDesc, iconUrl, bannerUrl, slug], ...]
 */
export function parseGoogleWorkspaceAppPage(html: string, slug: string): NormalizedAppDetails {
  // Try structured JSON first (much more reliable)
  const ds1 = extractAfData(html, "ds:1");
  if (Array.isArray(ds1) && ds1.length >= 15 && typeof ds1[0] === "number") {
    const entry = parseAppEntry(ds1);
    if (entry && entry.name) {
      log.info("parsed app from embedded JSON", { slug, name: entry.name });
      return buildFromEntry(entry, slug, html);
    }
  }

  // ds:1 may be wrapped: [[entry]] on some pages
  if (Array.isArray(ds1) && ds1.length === 1 && Array.isArray(ds1[0])) {
    const inner = ds1[0];
    if (Array.isArray(inner) && inner.length >= 15) {
      const entry = parseAppEntry(inner);
      if (entry && entry.name) {
        log.info("parsed app from embedded JSON (wrapped)", { slug, name: entry.name });
        return buildFromEntry(entry, slug, html);
      }
    }
  }

  // Fallback: DOM parsing with real selectors
  log.warn("falling back to DOM parsing", { slug });
  return parseFromDom(html, slug);
}

function buildFromEntry(entry: GWorkspaceAppEntry, slug: string, html: string): NormalizedAppDetails {
  const worksWithApps = mapWorksWithCodes(entry.worksWithCodes);
  const googleWorkspaceAppId = String(entry.appId);

  // Enrich with DOM-only fields (pricing, screenshots, category, CASA)
  const $ = cheerio.load(html);
  const domExtras = extractDomExtras($);

  const badges: string[] = [];
  if (domExtras.casaCertified) badges.push("casa_certified");

  return {
    name: entry.name,
    slug,
    averageRating: entry.rating || null,
    ratingCount: entry.reviewCount || null,
    pricingHint: domExtras.pricingHint,
    pricingModel: normalizePricingModel(domExtras.pricingHint),
    iconUrl: entry.iconUrl || null,
    developer: entry.developerName
      ? {
          name: entry.developerName,
          url: entry.developerWebsite || undefined,
          website: entry.developerWebsite || undefined,
        }
      : null,
    badges,
    platformData: {
      googleWorkspaceAppId,
      shortDescription: entry.shortDescription,
      detailedDescription: entry.detailedDescription,
      category: domExtras.category,
      pricingModel: domExtras.pricingModel,
      screenshots: domExtras.screenshots,
      worksWithApps,
      termsOfServiceUrl: entry.termsOfServiceUrl,
      privacyPolicyUrl: entry.privacyPolicyUrl,
      supportUrl: entry.supportUrl,
      casaCertified: domExtras.casaCertified,
      installCount: entry.installCountExact,
      developerWebsite: entry.developerWebsite || null,
      listingUpdated: domExtras.listingUpdated,
    },
  };
}

/**
 * Extract fields only available in the DOM (not in AF_initDataCallback JSON).
 */
function extractDomExtras($: cheerio.CheerioAPI): {
  pricingHint: string | null;
  pricingModel: string;
  screenshots: string[];
  category: string;
  casaCertified: boolean;
  listingUpdated: string | null;
} {
  // Pricing — from span.P0vMD next to "Pricing" label
  let pricingHint: string | null = null;
  $("span.Fejld").each((_, el) => {
    if ($(el).text().trim() === "Pricing") {
      pricingHint = $(el).siblings("span.P0vMD").text().trim() || null;
    }
  });
  const pricingModel = normalizePricingHint(pricingHint);

  // Screenshots — img.ec1OGc (distinct from icon img.TS9dEf)
  const screenshots: string[] = [];
  $("img.ec1OGc").each((_, el) => {
    const src = $(el).attr("src");
    if (src && !screenshots.includes(src) && screenshots.length < 10) {
      screenshots.push(src);
    }
  });

  // Category — active sidebar link with class Qh16y
  let category = "";
  const activeCategory = $("a.G3sBi.Qh16y").first();
  if (activeCategory.length) {
    const href = activeCategory.attr("href") || "";
    const match = href.match(/\/category\/([^/?]+)(?:\/([^/?]+))?/);
    if (match) category = match[2] ? `${match[1]}/${match[2]}` : match[1];
  }

  // CASA certification
  const bodyText = $.text();
  const casaCertified = bodyText.toLowerCase().includes("casa") ||
    bodyText.includes("Cloud Application Security Assessment");

  // Listing updated date — in div.bVxKXd containing "Listing updated:"
  let listingUpdated: string | null = null;
  $("div.bVxKXd").each((_, el) => {
    const text = $(el).text().trim();
    const match = text.match(/Listing updated:\s*(.+)/);
    if (match) listingUpdated = match[1].trim();
  });

  return { pricingHint, pricingModel, screenshots, category, casaCertified, listingUpdated };
}

/**
 * Fallback DOM parser using real CSS classes discovered during exploration.
 *
 * Key selectors:
 * - span.BfHp9b[itemprop="name"] — app name
 * - div.kmwdk — short description
 * - pre.nGA4ed — detailed description
 * - meta[itemprop="ratingValue"] — rating
 * - span[itemprop="ratingCount"] — review count
 * - img.TS9dEf — app icon
 * - img.ec1OGc — screenshots
 * - div.ebrG6d div.eqVmXb[data-tooltip] — works with
 * - span.P0vMD — pricing text
 * - div.oPwrAb[data-app-id] — app container
 * - a.Qh16y — active category in sidebar
 */
function parseFromDom(html: string, slug: string): NormalizedAppDetails {
  const $ = cheerio.load(html);

  // App name
  const name =
    $("span.BfHp9b").first().text().trim() ||
    $('[itemprop="name"]').first().text().trim() ||
    $("h1").first().text().trim() ||
    "";

  // Icon URL — specific icon class, not screenshots
  const iconUrl =
    $("img.TS9dEf").first().attr("src") ||
    $('img[alt="App Icon"]').first().attr("src") ||
    null;

  // Developer — look for the developer row
  let developerName = "";
  let developerWebsite: string | null = null;
  $("span.Fejld").each((_, el) => {
    if ($(el).text().trim() === "Developer") {
      const valueContainer = $(el).siblings("span.nWIEC, span.uhepde").first();
      const link = valueContainer.find("a.DmgOFc").first();
      developerName = link.text().trim() || valueContainer.text().trim();
      developerWebsite = link.attr("href") || null;
    }
  });

  // Rating
  const ratingText = $('meta[itemprop="ratingValue"]').attr("content") || "";
  const averageRating = safeParseFloat(ratingText);
  const ratingCountText = $('span[itemprop="ratingCount"]').text().trim();
  const ratingCount = ratingCountText ? parseInt(ratingCountText, 10) : null;

  // Short description
  const shortDescription = $("div.kmwdk").text().trim();

  // Detailed description (note: <pre> tag)
  const detailedDescription = $("pre.nGA4ed").text().trim();

  // Pricing
  let pricingHint: string | null = null;
  $("span.Fejld").each((_, el) => {
    if ($(el).text().trim() === "Pricing") {
      pricingHint = $(el).siblings("span.P0vMD").text().trim() || null;
    }
  });
  const pricingModel = normalizePricingHint(pricingHint);

  // Screenshots — specific class, exclude icon
  const screenshots: string[] = [];
  $("img.ec1OGc").each((_, el) => {
    const src = $(el).attr("src");
    if (src && !screenshots.includes(src) && screenshots.length < 10) {
      screenshots.push(src);
    }
  });

  // Works with apps — from data-tooltip attributes
  const worksWithApps: string[] = [];
  $("div.ebrG6d div.eqVmXb[data-tooltip]").each((_, el) => {
    const tooltip = $(el).attr("data-tooltip") || "";
    const match = tooltip.match(/works with (.+)/i);
    if (match) worksWithApps.push(match[1]);
  });
  // Also try aria-label
  if (worksWithApps.length === 0) {
    $("div.ebrG6d div.eqVmXb[aria-label]").each((_, el) => {
      const label = $(el).attr("aria-label") || "";
      const match = label.match(/works with (.+)/i);
      if (match) worksWithApps.push(match[1]);
    });
  }

  // Category — active sidebar link
  const activeCategory = $("a.G3sBi.Qh16y").first();
  let category = "";
  if (activeCategory.length) {
    const href = activeCategory.attr("href") || "";
    const match = href.match(/\/category\/([^/?]+)(?:\/([^/?]+))?/);
    if (match) category = match[2] ? `${match[1]}/${match[2]}` : match[1];
  }

  // App ID from container
  const appId = $("div.oPwrAb[data-app-id]").attr("data-app-id") || "";
  const parts = slug.split("--");
  const googleWorkspaceAppId = appId || (parts.length > 1 ? parts[parts.length - 1] : slug);

  // Support URLs
  const urls = extractInfoUrls($);

  // Install count
  const bodyText = $.text();
  const installCount = extractInstallCount(bodyText);

  // CASA certification
  const casaCertified = bodyText.toLowerCase().includes("casa") || bodyText.includes("Cloud Application Security Assessment");

  const badges: string[] = [];
  if (casaCertified) badges.push("casa_certified");

  log.info("parsed app from DOM", {
    slug,
    name,
    hasShortDesc: !!shortDescription,
    hasDetailedDesc: !!detailedDescription,
    screenshotCount: screenshots.length,
  });

  return {
    name,
    slug,
    averageRating,
    ratingCount,
    pricingHint,
    pricingModel: normalizePricingModel(pricingHint),
    iconUrl,
    developer: developerName
      ? { name: developerName, url: developerWebsite || undefined, website: developerWebsite || undefined }
      : null,
    badges,
    platformData: {
      googleWorkspaceAppId,
      shortDescription,
      detailedDescription,
      category,
      pricingModel,
      screenshots,
      worksWithApps,
      termsOfServiceUrl: urls.termsOfServiceUrl,
      privacyPolicyUrl: urls.privacyPolicyUrl,
      supportUrl: urls.supportUrl,
      casaCertified,
      installCount,
      developerWebsite,
    },
  };
}

function extractInfoUrls($: cheerio.CheerioAPI): {
  termsOfServiceUrl: string;
  privacyPolicyUrl: string;
  supportUrl: string;
} {
  const urls = { termsOfServiceUrl: "", privacyPolicyUrl: "", supportUrl: "" };

  $("span.Fejld").each((_, el) => {
    const label = $(el).text().trim().toLowerCase();
    const link = $(el).siblings("span.uhepde").find("a.DmgOFc").first();
    const href = link.attr("href") || "";

    if (label.includes("terms")) urls.termsOfServiceUrl = href;
    else if (label.includes("privacy")) urls.privacyPolicyUrl = href;
    else if (label.includes("support")) urls.supportUrl = href;
  });

  return urls;
}

function normalizePricingHint(hint: string | null): string {
  if (!hint) return "unknown";
  const lower = hint.toLowerCase();
  if (lower.includes("trial")) return "free_trial";
  if (lower.includes("paid features") || lower.includes("freemium")) return "freemium";
  if (lower.includes("paid") && !lower.includes("free")) return "paid";
  if (lower.includes("free")) return "free";
  return "unknown";
}

function extractInstallCount(text: string): number | null {
  const patterns = [
    /(\d[\d,]*)\+?\s*(users|installs|downloads)/i,
    /(\d+(?:\.\d+)?)\s*([KkMmBb])\+?\s*(users|installs)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let num = safeParseFloat(match[1].replace(/,/g, ""));
      if (num == null) continue;
      const suffix = match[2]?.toUpperCase();
      if (suffix === "K") num *= 1000;
      else if (suffix === "M") num *= 1000000;
      else if (suffix === "B") num *= 1000000000;
      return Math.round(num);
    }
  }
  return null;
}
