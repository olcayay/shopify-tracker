import { createLogger, normalizePricingModel } from "@appranks/shared";
import type { NormalizedAppDetails } from "../../platform-module.js";

const log = createLogger("salesforce-app-parser");

/**
 * Parse Salesforce AppExchange app detail page.
 *
 * Extracts `window.stores.LISTING.listing` JSON from the rendered SPA HTML
 * and normalizes it into the canonical schema.
 */
export function parseSalesforceAppPage(html: string, slug: string): NormalizedAppDetails {
  const stores = extractWindowStores(html);
  if (!stores) {
    log.warn("no window.stores found in HTML", { slug });
    return fallback(html, slug);
  }

  const listing = stores?.LISTING?.listing;
  if (!listing) {
    log.warn("no LISTING.listing in window.stores", { slug });
    return fallback(html, slug);
  }

  return normalizeListing(listing, slug);
}

/**
 * Parse the JSON response from `partners/experience/listings/{id}` (PLA-1055).
 * The response is shaped like the `listing` object embedded in `window.stores`,
 * so we delegate to the same normalizer. A parse failure returns the same
 * minimal shape as the HTML fallback so upstream code handles both identically.
 */
export function parseListingJson(raw: unknown, slug: string): NormalizedAppDetails {
  if (!raw || typeof raw !== "object") {
    log.warn("parseListingJson: non-object payload", { slug });
    return emptyFallback(slug);
  }
  return normalizeListing(raw as Record<string, any>, slug);
}

/** Shared normalizer used by both the HTML (window.stores) and HTTP (partners/experience) paths. */
function normalizeListing(listing: Record<string, any>, slug: string): NormalizedAppDetails {
  const ext = getExtensionData(listing);
  const pricing = listing.pricing || {};
  const publisher = listing.publisher;

  return {
    name: listing.title || listing.name || slug,
    slug,
    averageRating: listing.reviewsSummary?.averageRating ?? null,
    ratingCount: listing.reviewsSummary?.reviewCount ?? listing.reviewsSummary?.totalReviewCount ?? null,
    pricingHint: pricing?.price_model_type || null,
    pricingModel: normalizePricingModel(pricing?.price_model_type || null),
    iconUrl: extractLogoUrl(listing),
    developer: publisher
      ? {
          name: typeof publisher === "string" ? publisher : publisher.name || "",
          url: undefined,
          website: typeof publisher === "object" ? publisher.website || undefined : undefined,
        }
      : null,
    badges: [],
    platformData: {
      description: listing.description || "",
      fullDescription: listing.fullDescription || "",
      highlights: ext?.highlights || [],
      publishedDate: ext?.publishedDate || null,
      languages: ext?.languages || [],
      listingCategories: ext?.listingCategories || [],
      productsSupported: ext?.productsSupported || [],
      productsRequired: ext?.productsRequired || [],
      pricingModelType: pricing?.price_model_type || null,
      pricingPlans: normalizePlans(pricing?.model?.plans),
      publisher: normalizePublisher(listing.publisher),
      technology: listing.technology,
      editions: ext?.editions || [],
      supportedIndustries: ext?.supportedIndustries || [],
      targetUserPersona: ext?.targetUserPersona || [],
      solution: normalizeSolution(listing.solution),
      businessNeeds: flattenBusinessNeeds(listing.businessNeeds),
      plugins: normalizePlugins(listing.plugins),
    },
  };
}

function emptyFallback(slug: string): NormalizedAppDetails {
  return {
    name: slug,
    slug,
    averageRating: null,
    ratingCount: null,
    pricingHint: null,
    pricingModel: null,
    iconUrl: null,
    developer: null,
    badges: [],
    platformData: {},
  };
}

// --- Internal helpers ---

/**
 * Flatten Salesforce businessNeeds from nested object to array of selected keys.
 * API returns: { marketing: { categories: [...], isSelected: true }, ... }
 * We want: ["customerService", "analytics"] (only isSelected: true keys)
 */
export function flattenBusinessNeeds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw as Record<string, any>)
    .filter(([, v]) => v && v.isSelected)
    .map(([key]) => key);
}

function extractWindowStores(html: string): any | null {
  const match = html.match(/window\.stores\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (err) {
    log.warn("failed to parse window.stores JSON", { error: String(err) });
    return null;
  }
}

function getExtensionData(listing: any): any | null {
  const extensions = listing.extensions || [];
  for (const ext of extensions) {
    if (ext.extensionType === "listing/extensions/force/listings/Listing") {
      return ext.data;
    }
  }
  return extensions[0]?.data || null;
}

function extractLogoUrl(listing: any): string | null {
  // Try plugins first (normalized logos)
  const plugins = listing.plugins;
  if (Array.isArray(plugins)) {
    for (const pl of plugins) {
      if (!pl || typeof pl !== "object") continue;
      const ptype = pl.pluginType || "";
      if (ptype.includes("LogoSet")) {
        const items = pl.data?.items || [];
        for (const it of items) {
          const d = it?.data || it;
          if (d?.logoType === "Logo") {
            return d.mediaId || d.url || null;
          }
        }
        // Fallback to first logo
        const first = items[0]?.data || items[0];
        if (first) return first.mediaId || first.url || null;
      }
    }
  }

  // Fallback: listing.logos array
  const logos = listing.logos;
  if (Array.isArray(logos) && logos.length > 0) {
    const logo = logos.find((l: any) => l.logoType === "Logo") || logos[0];
    return logo.mediaId || logo.url || null;
  }

  return null;
}

function normalizePublisher(pub: any): Record<string, unknown> | null {
  if (!pub || typeof pub !== "object") return null;
  return {
    name: pub.name || null,
    email: pub.email || null,
    website: pub.website || null,
    description: pub.description || null,
    employees: pub.employees ?? null,
    yearFounded: pub.yearFounded ?? null,
    location: pub.hQLocation || pub.location || null,
    country: pub.country || null,
  };
}

function normalizePlans(plans: any[]): Record<string, unknown>[] {
  if (!Array.isArray(plans)) return [];
  return plans
    .filter((p) => p && typeof p === "object")
    .map((p) => ({
      plan_name: p.plan_name || null,
      price: p.price ?? null,
      currency_code: p.currency_code || null,
      units: p.units || null,
      frequency: p.frequency || null,
      trial_days: p.trial_days ?? 0,
    }));
}

function normalizeSolution(sol: any): Record<string, unknown> | null {
  if (!sol || typeof sol !== "object") return null;
  const inner = sol.solution || {};
  const manifest = inner.manifest || {};
  return {
    manifest: manifest && typeof manifest === "object"
      ? {
          hasLWC: manifest.hasLWC,
          tabsCount: manifest.tabsCount,
          objectsCount: manifest.objectsCount,
          applicationsCount: manifest.applicationsCount,
          globalComponentsCount: manifest.globalComponentsCount,
          cmtyBuilderComponentsCount: manifest.cmtyBuilderComponentsCount,
          isCommunityBuilder: manifest.isCommunityBuilder,
          isLightningAppBuilder: manifest.isLightningAppBuilder,
          appBuilderComponentsCount: manifest.appBuilderComponentsCount,
        }
      : null,
    latestVersionDate: inner.latestVersionDate || null,
    packageId: inner.packageId || null,
    namespacePrefix: inner.namespacePrefix || null,
    packageCategory: inner.packageCategory || null,
    createdDate: inner.createdDate || null,
    lastModifiedDate: inner.lastModifiedDate || null,
  };
}

function normalizePlugins(plugins: any[]): Record<string, unknown> | null {
  if (!Array.isArray(plugins)) return null;
  const result: Record<string, any[]> = {
    videos: [],
    resources: [],
    carousel: [],
    logos: [],
  };

  for (const pl of plugins) {
    if (!pl || typeof pl !== "object") continue;
    const ptype = pl.pluginType || "";
    const data = pl.data || {};
    const items = data.items || [];

    if (ptype.includes("Demo")) {
      for (const it of items) {
        const d = it?.data || it;
        if (d?.url) {
          result.videos.push({
            url: d.url,
            type: d.type || null,
            caption: d.title || d.caption || null,
          });
        }
      }
    } else if (ptype.includes("Content")) {
      for (const it of items) {
        const d = it?.data || it;
        const url = d?.url || (typeof d?.mediaId === "string" ? d.mediaId : null);
        if (url) {
          result.resources.push({
            url,
            type: d?.type || it?.type || null,
            title: d?.title || d?.caption || null,
          });
        }
      }
    } else if (ptype.includes("Carousel")) {
      for (const it of items) {
        const d = it?.data || it;
        if (d && (d.mediaId || d.url)) {
          result.carousel.push({
            url: d.mediaId || d.url,
            caption: d.caption || null,
            altText: d.altText || null,
          });
        }
      }
    } else if (ptype.includes("LogoSet")) {
      for (const it of items) {
        const d = it?.data || it;
        const url = d?.mediaId || d?.url || it?.mediaId;
        if (url) {
          result.logos.push({
            url,
            logoType: d?.logoType || it?.logoType || null,
          });
        }
      }
    }
  }

  // Drop empty arrays
  for (const key of Object.keys(result)) {
    if (result[key].length === 0) delete result[key];
  }
  return Object.keys(result).length > 0 ? result : null;
}

function fallback(html: string, slug: string): NormalizedAppDetails {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const name = titleMatch
    ? titleMatch[1].replace(/\s*[-|]\s*Salesforce AppExchange.*$/i, "").trim()
    : slug;

  log.info("app page parsed with minimal data (fallback)", { slug });

  return {
    name,
    slug,
    averageRating: null,
    ratingCount: null,
    pricingHint: null,
    pricingModel: null,
    iconUrl: null,
    developer: null,
    badges: [],
    platformData: {},
  };
}
