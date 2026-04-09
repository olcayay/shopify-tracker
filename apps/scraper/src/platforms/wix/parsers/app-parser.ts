import * as cheerio from "cheerio";
import { createLogger, safeParseFloat, normalizePricingModel } from "@appranks/shared";
import type { NormalizedAppDetails, NormalizedReviewPage, NormalizedReview } from "../../platform-module.js";

const log = createLogger("wix-app-parser");

/**
 * Extract the __REACT_QUERY_STATE__ JSON from Wix pages.
 * The data is base64-encoded inside: window.__REACT_QUERY_STATE__ = JSON.parse(__decodeBase64('...'))
 */
export function extractReactQueryState(html: string): any | null {
  const match = html.match(
    /window\.__REACT_QUERY_STATE__\s*=\s*JSON\.parse\(__decodeBase64\('([^']+)'\)\)/
  );
  if (!match) return null;
  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch (e) {
    log.warn("failed to decode __REACT_QUERY_STATE__", { error: String(e) });
    return null;
  }
}

/**
 * Find the main data query (typically queries[2]) from the React Query state.
 * Looks for a query key matching the given prefix.
 */
function findQueryData(state: any, keyPrefix: string): any | null {
  if (!state?.queries) return null;
  for (const q of state.queries) {
    const key = Array.isArray(q.queryKey) ? q.queryKey[0] : q.queryKey;
    if (typeof key === "string" && key.startsWith(keyPrefix)) {
      return q.state?.data ?? null;
    }
  }
  return null;
}

/** Parse Wix app detail page into normalized format */
export function parseWixAppPage(html: string, slug: string): NormalizedAppDetails {
  const state = extractReactQueryState(html);
  const data = state ? findQueryData(state, `app-page-${slug}`) : null;

  if (data?.app) {
    return parseFromJson(data, slug);
  }

  // Fallback: DOM parsing with data-hook selectors
  log.warn("no JSON data found, falling back to DOM parsing", { slug });
  return parseFromDom(html, slug);
}

function parseFromJson(data: any, slug: string): NormalizedAppDetails {
  const app = data.app;
  const overview = data.overview;
  const companyInfo = data.companyInfo;
  const reviews = data.reviews;
  const quickInfo = data.quickInfo;
  const properties = data.properties;
  const pricingPlans = data.pricingPlans;

  // Pricing hint
  let pricingHint: string | null = null;
  if (app.pricing?.label?.type === "FREE") {
    pricingHint = "Free";
  } else if (app.pricing?.label?.type === "FREE_PLAN_AVAILABLE") {
    pricingHint = "Free plan available";
  } else if (app.pricing?.label?.type) {
    pricingHint = "Paid";
  }

  // Categories
  const categories = (quickInfo?.subCategories ?? []).map((sc: any) => ({
    slug: sc.parentSlug ? `${sc.parentSlug}--${sc.slug}` : sc.slug,
    title: sc.name,
    parentSlug: sc.parentSlug,
    parentTitle: sc.parentName,
    url: sc.parentSlug
      ? `https://www.wix.com/app-market/category/${sc.parentSlug}/${sc.slug}`
      : `https://www.wix.com/app-market/category/${sc.slug}`,
  }));

  // Screenshots / media
  const screenshots = (quickInfo?.media ?? [])
    .filter((m: any) => m.type === "IMAGE")
    .map((m: any) => m.url);

  // Pricing plans normalized
  const plans = (pricingPlans?.plans ?? []).map((p: any) => ({
    name: p.name,
    isFree: p.isFree,
    monthlyPrice: p.monthlyPrice?.price ?? null,
    yearlyPrice: p.yearlyPrice?.price ?? null,
    oneTimePrice: p.oneTimePrice?.price ?? null,
    type: p.type,
    benefits: p.description?.benefits ?? [],
  }));

  // Rating breakdown
  const ratingHistogram = reviews?.reviewsSummary?.ratingHistogram;

  // Collections
  const collections = (properties?.appCollections ?? []).map((c: any) => ({
    slug: c.slug,
    name: c.name,
  }));

  return {
    name: app.name || slug,
    slug,
    averageRating: app.reviews?.averageRating ?? null,
    ratingCount: app.reviews?.totalCount ?? null,
    pricingHint,
    pricingModel: normalizePricingModel(pricingHint),
    iconUrl: app.icon || null,
    developer: companyInfo
      ? {
          name: companyInfo.name,
          url: companyInfo.slug
            ? `https://www.wix.com/app-market/developer/${companyInfo.slug}`
            : undefined,
          website: companyInfo.websiteUrl || undefined,
        }
      : null,
    badges: (app.appBadges ?? []).map((b: any) => b.badge),
    platformData: {
      tagline: app.shortDescription || null,
      description: overview?.description || null,
      benefits: (overview?.benefits ?? []).map((b: any) => b.title),
      demoUrl: overview?.demoUrl || null,
      categories,
      collections,
      screenshots,
      pricingPlans: plans,
      currency: pricingPlans?.currencySettings?.code || null,
      isFreeApp: pricingPlans?.isFreeApp ?? null,
      trialDays: pricingPlans?.trialDays ?? 0,
      languages: properties?.supportedLanguages ?? [],
      isAvailableWorldwide: properties?.geoAvailability?.isAvailableWorldwide ?? null,
      ratingHistogram: ratingHistogram
        ? {
            rating5: ratingHistogram.rating5,
            rating4: ratingHistogram.rating4,
            rating3: ratingHistogram.rating3,
            rating2: ratingHistogram.rating2,
            rating1: ratingHistogram.rating1,
          }
        : null,
      promotionalImage: app.promotionalImage || null,
      developerEmail: companyInfo?.contactUs || null,
      developerPrivacyUrl: companyInfo?.privacyPolicyUrl || null,
    },
  };
}

function parseFromDom(html: string, slug: string): NormalizedAppDetails {
  const $ = cheerio.load(html);

  const name = $('[data-hook="app-name-heading"]').text().trim() || slug;
  const ratingText = $('[data-hook="average-rating-heading"]').text().trim();
  const ratingMatch = ratingText.match(/([\d.]+)/);
  const averageRating = safeParseFloat(ratingMatch?.[1]);
  const reviewCountText = $('[data-hook="reviews-number-subtitle"]').text().trim();
  const ratingCount = reviewCountText ? parseInt(reviewCountText.replace(/[^0-9]/g, ""), 10) || null : null;
  const developerName = $('[data-hook="company-info-name"]').text().trim();
  const iconUrl = $('[data-hook="app-name-heading"]').closest("div").find("img").first().attr("src") || null;

  return {
    name,
    slug,
    averageRating,
    ratingCount,
    pricingHint: null,
    pricingModel: null,
    iconUrl,
    developer: developerName ? { name: developerName } : null,
    badges: [],
    platformData: {
      tagline: $('[data-hook="app-overview-description"]').text().trim() || null,
    },
  };
}

/** Parse reviews from the app detail page JSON data */
export function parseWixReviewPage(html: string, page: number): NormalizedReviewPage {
  const state = extractReactQueryState(html);

  // Find app-page query data
  let data: any = null;
  if (state?.queries) {
    for (const q of state.queries) {
      const key = Array.isArray(q.queryKey) ? q.queryKey[0] : q.queryKey;
      if (typeof key === "string" && key.startsWith("app-page-")) {
        data = q.state?.data;
        break;
      }
    }
  }

  if (!data?.reviews?.reviews) {
    return { reviews: [], hasNextPage: false, currentPage: page };
  }

  const reviews: NormalizedReview[] = data.reviews.reviews.map((r: any) => {
    const reply = r.replies?.[0];
    return {
      reviewDate: r.createdAt || "",
      content: r.description || r.title || "",
      reviewerName: r.userName || "Anonymous",
      reviewerCountry: "",
      durationUsingApp: "",
      rating: r.rate || 0,
      developerReplyDate: reply?.createdAt || null,
      developerReplyText: reply?.description || null,
    };
  });

  return {
    reviews,
    hasNextPage: false, // Initial page includes embedded reviews; pagination needs investigation
    currentPage: page,
  };
}
