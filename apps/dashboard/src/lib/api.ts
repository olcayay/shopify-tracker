import { cache } from "react";
import { cookies } from "next/headers";
import type { PlatformId } from "@appranks/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function getAuthToken(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get("access_token")?.value;
  } catch {
    return undefined;
  }
}

/** Append ?platform= query param to a path */
function withPlatform(path: string, platform?: PlatformId): string {
  if (!platform) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}platform=${platform}`;
}

async function fetchApi<T>(path: string, options?: RequestInit & { next?: { revalidate?: number; tags?: string[] } }): Promise<T> {
  const token = await getAuthToken();
  const url = `${API_BASE}${path}`;
  const method = options?.method?.toUpperCase() || "GET";
  // GET requests default to 30-second revalidation (authenticated data should be fresh);
  // mutations use no-store
  const cacheOptions = method !== "GET"
    ? { cache: "no-store" as const }
    : options?.next
      ? { next: options.next }
      : options?.cache
        ? { cache: options.cache }
        : { next: { revalidate: 30 } };

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers || {}),
      },
      ...cacheOptions,
    });
  } catch {
    throw new Error("Service temporarily unavailable. Please try again in a moment.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }

  return res.json();
}

// --- Public (no auth required) ---
async function fetchPublicApi<T>(path: string, options?: RequestInit & { next?: { revalidate?: number; tags?: string[] } }): Promise<T> {
  const url = `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
      next: options?.next ?? { revalidate: 3600 },
    });
  } catch {
    throw new Error("Service temporarily unavailable. Please try again in a moment.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
  return res.json();
}

export const getPublicApp = cache((platform: string, slug: string) => {
  return fetchPublicApi<any>(`/api/public/apps/${platform}/${slug}`);
});

export const getPublicCategory = cache((platform: string, slug: string) => {
  return fetchPublicApi<any>(`/api/public/categories/${platform}/${slug}`);
});

export const getPublicCategoryTree = cache((platform: string) => {
  return fetchPublicApi<any[]>(`/api/public/categories/${platform}`);
});

export const getPublicDeveloper = cache((platform: string, slug: string) => {
  return fetchPublicApi<any>(`/api/public/developers/${platform}/${slug}`);
});

export const getPublicPlatformStats = cache((platform: string) => {
  return fetchPublicApi<any>(`/api/public/platforms/${platform}/stats`);
});

export const getPublicComparison = cache((platform: string, slug1: string, slug2: string) => {
  return fetchPublicApi<any>(`/api/public/compare/${platform}/${slug1}/${slug2}`);
});

export const getPublicKeyword = cache((platform: string, slug: string) => {
  return fetchPublicApi<any>(`/api/public/keywords/${platform}/${slug}`);
});

export const getPublicAudit = cache((platform: string, slug: string) => {
  return fetchPublicApi<any>(`/api/public/audit/${platform}/${slug}`);
});

// --- Categories ---
export function getCategories(format: "tree" | "flat" = "tree", platform?: PlatformId) {
  return fetchApi<any[]>(withPlatform(`/api/categories?format=${format}`, platform));
}

export function getCategory(slug: string, platform?: PlatformId) {
  return fetchApi<any>(withPlatform(`/api/categories/${slug}`, platform));
}

export function getCategoriesBatch(slugs: string[], platform?: PlatformId) {
  return fetchApi<Record<string, { leaders: any[]; appCount: number | null }>>(
    withPlatform(`/api/categories/batch`, platform),
    { method: "POST", body: JSON.stringify({ slugs }), headers: { "Content-Type": "application/json" } }
  );
}

export function getCategoryHistory(slug: string, limit = 20, platform?: PlatformId) {
  return fetchApi<any>(withPlatform(`/api/categories/${slug}/history?limit=${limit}`, platform));
}

// --- Apps ---
export function getApps(platform?: PlatformId) {
  return fetchApi<any[]>(withPlatform(`/api/apps`, platform));
}

export const getApp = cache((slug: string, platform?: PlatformId) => {
  return fetchApi<any>(withPlatform(`/api/apps/${slug}`, platform));
});

export const getAppHistory = cache((slug: string, limit = 20, platform?: PlatformId) => {
  return fetchApi<any>(withPlatform(`/api/apps/${slug}/history?limit=${limit}`, platform));
});

export const getAppReviews = cache((
  slug: string,
  limit = 20,
  offset = 0,
  sort = "newest",
  platform?: PlatformId,
) => {
  return fetchApi<any>(
    withPlatform(`/api/apps/${slug}/reviews?limit=${limit}&offset=${offset}&sort=${sort}`, platform)
  );
});

export const getAppRankings = cache((slug: string, days = 30, platform?: PlatformId) => {
  return fetchApi<any>(withPlatform(`/api/apps/${slug}/rankings?days=${days}`, platform));
});

export const getAppChanges = cache((slug: string, limit = 50, platform?: PlatformId) => {
  return fetchApi<any[]>(withPlatform(`/api/apps/${slug}/changes?limit=${limit}`, platform));
});

export const getAppSimilarApps = cache((slug: string, days = 30, platform?: PlatformId) => {
  return fetchApi<any>(withPlatform(`/api/apps/${slug}/similar-apps?days=${days}`, platform));
});

export const getAppFeaturedPlacements = cache((slug: string, days = 30, platform?: PlatformId) => {
  return fetchApi<any>(withPlatform(`/api/apps/${slug}/featured-placements?days=${days}`, platform));
});

export const getAppAdSightings = cache((slug: string, days = 30, platform?: PlatformId) => {
  return fetchApi<any>(withPlatform(`/api/apps/${slug}/ad-sightings?days=${days}`, platform));
});

export const getAppCategoryAdSightings = cache((slug: string, days = 30, platform?: PlatformId) => {
  return fetchApi<any>(withPlatform(`/api/apps/${slug}/category-ad-sightings?days=${days}`, platform));
});

export const getCategoryAds = cache((slug: string, days = 30, platform?: PlatformId) => {
  return fetchApi<any>(withPlatform(`/api/categories/${slug}/ads?days=${days}`, platform));
});

// --- Featured Apps ---
export function getFeaturedApps(
  days = 30,
  surface?: string,
  surfaceDetail?: string,
  surfaceDetailPrefix?: string,
  platform?: PlatformId,
) {
  const params = new URLSearchParams({ days: String(days) });
  if (surface) params.set("surface", surface);
  if (surfaceDetail) params.set("surfaceDetail", surfaceDetail);
  if (surfaceDetailPrefix) params.set("surfaceDetailPrefix", surfaceDetailPrefix);
  return fetchApi<any>(withPlatform(`/api/featured-apps?${params}`, platform));
}

export function getFeaturedSections(days = 30, platform?: PlatformId) {
  return fetchApi<any[]>(withPlatform(`/api/featured-apps/sections?days=${days}`, platform));
}

export function getAppsLastChanges(slugs: string[], platform?: PlatformId) {
  if (slugs.length === 0) return Promise.resolve({} as Record<string, string>);
  return fetchApi<Record<string, string>>(withPlatform(`/api/apps/last-changes`, platform), {
    method: "POST",
    body: JSON.stringify({ slugs }),
  });
}

export function getAppsMinPaidPrices(slugs: string[], platform?: PlatformId) {
  if (slugs.length === 0) return Promise.resolve({} as Record<string, number | null>);
  return fetchApi<Record<string, number | null>>(withPlatform(`/api/apps/min-paid-prices`, platform), {
    method: "POST",
    body: JSON.stringify({ slugs }),
  });
}

export function getAppsReverseSimilarCounts(slugs: string[], platform?: PlatformId) {
  if (slugs.length === 0) return Promise.resolve({} as Record<string, number>);
  return fetchApi<Record<string, number>>(withPlatform(`/api/apps/reverse-similar-counts`, platform), {
    method: "POST",
    body: JSON.stringify({ slugs }),
  });
}

export function getAppsCategories(slugs: string[], platform?: PlatformId) {
  if (slugs.length === 0) return Promise.resolve({} as Record<string, { title: string; slug: string; position: number | null }[]>);
  return fetchApi<Record<string, { title: string; slug: string; position: number | null }[]>>(withPlatform(`/api/apps/categories`, platform), {
    method: "POST",
    body: JSON.stringify({ slugs }),
  });
}

export function getAppsLaunchedDates(slugs: string[], platform?: PlatformId) {
  if (slugs.length === 0) return Promise.resolve({} as Record<string, string | null>);
  return fetchApi<Record<string, string | null>>(withPlatform(`/api/apps/launched-dates`, platform), {
    method: "POST",
    body: JSON.stringify({ slugs }),
  });
}

export function getAppsFeaturedSectionCounts(slugs: string[], platform?: PlatformId) {
  if (slugs.length === 0) return Promise.resolve({} as Record<string, number>);
  return fetchApi<Record<string, number>>(withPlatform(`/api/apps/featured-section-counts`, platform), {
    method: "POST",
    body: JSON.stringify({ slugs }),
  });
}

export function getAppsAdKeywordCounts(slugs: string[], platform?: PlatformId) {
  if (slugs.length === 0) return Promise.resolve({} as Record<string, number>);
  return fetchApi<Record<string, number>>(withPlatform(`/api/apps/ad-keyword-counts`, platform), {
    method: "POST",
    body: JSON.stringify({ slugs }),
  });
}

export interface ReviewVelocityMetrics {
  v7d: number | null;
  v30d: number | null;
  v90d: number | null;
  momentum: string | null;
}

export function getAppsReviewVelocity(slugs: string[], platform?: PlatformId) {
  if (slugs.length === 0) return Promise.resolve({} as Record<string, ReviewVelocityMetrics>);
  return fetchApi<Record<string, ReviewVelocityMetrics>>(withPlatform(`/api/apps/review-velocity`, platform), {
    method: "POST",
    body: JSON.stringify({ slugs }),
  });
}

export async function getAppReviewMetrics(slug: string, platform?: PlatformId): Promise<ReviewVelocityMetrics | null> {
  const result = await getAppsReviewVelocity([slug], platform);
  return result[slug] ?? null;
}

// --- Apps (search) ---
export function searchApps(q: string, platform?: PlatformId) {
  return fetchApi<any[]>(withPlatform(`/api/apps/search?q=${encodeURIComponent(q)}`, platform));
}

export function getAppsByDeveloper(name: string, platform?: PlatformId) {
  return fetchApi<any[]>(withPlatform(`/api/apps/by-developer?name=${encodeURIComponent(name)}`, platform));
}

// --- Keywords ---
export function getKeywords(platform?: PlatformId) {
  return fetchApi<any[]>(withPlatform(`/api/keywords`, platform));
}

export function getKeyword(slug: string, platform?: PlatformId) {
  return fetchApi<any>(withPlatform(`/api/keywords/${slug}`, platform));
}

export function getKeywordRankings(
  slug: string,
  days = 30,
  scope?: "account",
  platform?: PlatformId,
) {
  const params = new URLSearchParams({ days: String(days) });
  if (scope) params.set("scope", scope);
  return fetchApi<any>(withPlatform(`/api/keywords/${slug}/rankings?${params}`, platform));
}

export function getKeywordAds(slug: string, days = 30, platform?: PlatformId) {
  return fetchApi<any>(withPlatform(`/api/keywords/${slug}/ads?days=${days}`, platform));
}

export function getKeywordSuggestions(slug: string, platform?: PlatformId) {
  return fetchApi<{ suggestions: string[]; scrapedAt: string | null }>(withPlatform(`/api/keywords/${slug}/suggestions`, platform));
}

export function searchKeywords(q: string, platform?: PlatformId) {
  return fetchApi<any[]>(withPlatform(`/api/keywords/search?q=${encodeURIComponent(q)}`, platform));
}

// --- Features ---
export function getFeature(handle: string, platform?: PlatformId) {
  return fetchApi<any>(withPlatform(`/api/features/${encodeURIComponent(handle)}`, platform));
}

export function searchFeatures(q: string, platform?: PlatformId) {
  return fetchApi<any[]>(withPlatform(`/api/features/search?q=${encodeURIComponent(q)}`, platform));
}

export function getFeaturesByCategory(category?: string, subcategory?: string, platform?: PlatformId) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (subcategory) params.set("subcategory", subcategory);
  return fetchApi<any[]>(withPlatform(`/api/features/by-category?${params.toString()}`, platform));
}

// --- Integrations ---
export function getIntegration(name: string, platform?: PlatformId) {
  return fetchApi<any>(withPlatform(`/api/integrations/${encodeURIComponent(name)}`, platform));
}

// --- Platform Attributes ---
export function getPlatformAttribute(type: string, value: string, platform?: PlatformId) {
  return fetchApi<any>(withPlatform(`/api/platform-attributes/${encodeURIComponent(type)}/${encodeURIComponent(value)}`, platform));
}

// --- Auth ---
export function getUserProfile() {
  return fetchApi<any>(`/api/auth/me`, { cache: "no-store" });
}

/**
 * Server-side helper: returns the list of enabled feature flag slugs for the current user.
 * Cached per-request via React's cache() so multiple server components share one fetch.
 */
export const getEnabledFeatures = cache(async (): Promise<string[]> => {
  try {
    const data = await fetchApi<{ account?: { enabledFeatures?: string[] } }>(`/api/auth/me`, { cache: "no-store" });
    return data.account?.enabledFeatures ?? [];
  } catch {
    return [];
  }
});

// --- Account (user-specific, must be fresh) ---
export function getAccountInfo() {
  return fetchApi<any>(`/api/account`, { cache: "no-store" });
}

export function getAccountMembers() {
  return fetchApi<any[]>(`/api/account/members`, { cache: "no-store" });
}

export function getAccountTrackedApps(platform?: PlatformId) {
  return fetchApi<any[]>(withPlatform(`/api/account/tracked-apps`, platform), { cache: "no-store" });
}

export function getAccountTrackedKeywords(platform?: PlatformId) {
  return fetchApi<any[]>(withPlatform(`/api/account/tracked-keywords`, platform), { cache: "no-store" });
}

export function getAccountCompetitors(platform?: PlatformId) {
  return fetchApi<any[]>(withPlatform(`/api/account/competitors`, platform), { cache: "no-store" });
}

export function getAppCompetitors(slug: string, platform?: PlatformId, includeChanges = false) {
  const params = includeChanges ? `?includeChanges=true` : '';
  return fetchApi<any[]>(withPlatform(`/api/account/tracked-apps/${encodeURIComponent(slug)}/competitors${params}`, platform), { cache: "no-store" });
}

export function getAppKeywords(slug: string, platform?: PlatformId) {
  return fetchApi<any[]>(withPlatform(`/api/account/tracked-apps/${encodeURIComponent(slug)}/keywords`, platform), { cache: "no-store" });
}

export function getAccountStarredFeatures(platform?: PlatformId) {
  return fetchApi<any[]>(withPlatform(`/api/account/starred-features`, platform), { cache: "no-store" });
}

export function getAccountStarredCategories(platform?: PlatformId) {
  return fetchApi<any[]>(withPlatform(`/api/account/starred-categories`, platform), { cache: "no-store" });
}

// --- App Scores ---
export const getAppScores = cache((slug: string, platform?: PlatformId) => {
  return fetchApi<any>(withPlatform(`/api/apps/${slug}/scores`, platform));
});

export const getAppScoresHistory = cache((slug: string, days = 30, category?: string, platform?: PlatformId) => {
  const params = new URLSearchParams({ days: String(days) });
  if (category) params.set("category", category);
  return fetchApi<any>(withPlatform(`/api/apps/${slug}/scores/history?${params}`, platform));
});

export const getCategoryScores = cache((slug: string, limit = 50, platform?: PlatformId) => {
  return fetchApi<any>(withPlatform(`/api/categories/${slug}/scores?limit=${limit}`, platform));
});

// --- Membership ---
export function getKeywordMembership(slug: string, platform?: PlatformId) {
  return fetchApi<{ trackedAppSlugs: string[]; researchProjectIds: string[] }>(
    withPlatform(`/api/keywords/${encodeURIComponent(slug)}/membership`, platform),
    { cache: "no-store" }
  );
}

export function getAppMembership(slug: string, platform?: PlatformId) {
  return fetchApi<{ competitorForApps: string[]; researchProjectIds: string[] }>(
    withPlatform(`/api/apps/${encodeURIComponent(slug)}/membership`, platform),
    { cache: "no-store" }
  );
}

// --- Platforms ---
export function getPlatforms() {
  return fetchApi<any[]>(`/api/platforms`);
}

// --- Research Projects ---
export function getResearchProjects(platform?: PlatformId) {
  return fetchApi<any[]>(withPlatform(`/api/research-projects`, platform), { cache: "no-store" });
}

export function getResearchProjectData(id: string) {
  return fetchApi<any>(`/api/research-projects/${id}/data`);
}

// --- System Admin ---
export function getSystemAccounts() {
  return fetchApi<any[]>(`/api/system-admin/accounts`);
}

export function getSystemAccount(id: string) {
  return fetchApi<any>(`/api/system-admin/accounts/${id}`);
}

export function getSystemUsers() {
  return fetchApi<any[]>(`/api/system-admin/users`);
}

export function getSystemStats() {
  return fetchApi<any>(`/api/system-admin/stats`);
}

export function getScraperRuns(limit = 20) {
  return fetchApi<any[]>(`/api/system-admin/scraper/runs?limit=${limit}`);
}
