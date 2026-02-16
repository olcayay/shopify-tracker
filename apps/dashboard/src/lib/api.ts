import { cookies } from "next/headers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function getAuthToken(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get("access_token")?.value;
  } catch {
    return undefined;
  }
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getAuthToken();
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }

  return res.json();
}

// --- Categories ---
export function getCategories(format: "tree" | "flat" = "tree") {
  return fetchApi<any[]>(`/api/categories?format=${format}`);
}

export function getCategory(slug: string) {
  return fetchApi<any>(`/api/categories/${slug}`);
}

export function getCategoryHistory(slug: string, limit = 20) {
  return fetchApi<any>(`/api/categories/${slug}/history?limit=${limit}`);
}

// --- Apps ---
export function getApps() {
  return fetchApi<any[]>(`/api/apps`);
}

export function getApp(slug: string) {
  return fetchApi<any>(`/api/apps/${slug}`);
}

export function getAppHistory(slug: string, limit = 20) {
  return fetchApi<any>(`/api/apps/${slug}/history?limit=${limit}`);
}

export function getAppReviews(
  slug: string,
  limit = 20,
  offset = 0,
  sort = "newest"
) {
  return fetchApi<any>(
    `/api/apps/${slug}/reviews?limit=${limit}&offset=${offset}&sort=${sort}`
  );
}

export function getAppRankings(slug: string, days = 30) {
  return fetchApi<any>(`/api/apps/${slug}/rankings?days=${days}`);
}

// --- Apps (search) ---
export function searchApps(q: string) {
  return fetchApi<any[]>(`/api/apps/search?q=${encodeURIComponent(q)}`);
}

export function getAppsByDeveloper(name: string) {
  return fetchApi<any[]>(`/api/apps/by-developer?name=${encodeURIComponent(name)}`);
}

// --- Keywords ---
export function getKeywords() {
  return fetchApi<any[]>(`/api/keywords`);
}

export function getKeyword(slug: string) {
  return fetchApi<any>(`/api/keywords/${slug}`);
}

export function getKeywordRankings(
  slug: string,
  days = 30,
  scope?: "account"
) {
  const params = new URLSearchParams({ days: String(days) });
  if (scope) params.set("scope", scope);
  return fetchApi<any>(`/api/keywords/${slug}/rankings?${params}`);
}

export function getKeywordAds(slug: string, days = 30) {
  return fetchApi<any>(`/api/keywords/${slug}/ads?days=${days}`);
}

export function searchKeywords(q: string) {
  return fetchApi<any[]>(`/api/keywords/search?q=${encodeURIComponent(q)}`);
}

// --- Features ---
export function getFeature(handle: string) {
  return fetchApi<any>(`/api/features/${encodeURIComponent(handle)}`);
}

export function searchFeatures(q: string) {
  return fetchApi<any[]>(`/api/features/search?q=${encodeURIComponent(q)}`);
}

export function getFeaturesByCategory(category?: string, subcategory?: string) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (subcategory) params.set("subcategory", subcategory);
  return fetchApi<any[]>(`/api/features/by-category?${params.toString()}`);
}

// --- Auth ---
export function getUserProfile() {
  return fetchApi<any>(`/api/auth/me`);
}

// --- Account ---
export function getAccountInfo() {
  return fetchApi<any>(`/api/account`);
}

export function getAccountMembers() {
  return fetchApi<any[]>(`/api/account/members`);
}

export function getAccountTrackedApps() {
  return fetchApi<any[]>(`/api/account/tracked-apps`);
}

export function getAccountTrackedKeywords() {
  return fetchApi<any[]>(`/api/account/tracked-keywords`);
}

export function getAccountCompetitors() {
  return fetchApi<any[]>(`/api/account/competitors`);
}

export function getAccountTrackedFeatures() {
  return fetchApi<any[]>(`/api/account/tracked-features`);
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
