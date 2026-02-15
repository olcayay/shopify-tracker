const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
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
export function getApps(tracked: "true" | "false" | "all" = "true") {
  return fetchApi<any[]>(`/api/apps?tracked=${tracked}`);
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

// --- Keywords ---
export function getKeywords() {
  return fetchApi<any[]>(`/api/keywords`);
}

export function getKeyword(id: number) {
  return fetchApi<any>(`/api/keywords/${id}`);
}

export function getKeywordRankings(id: number, days = 30) {
  return fetchApi<any>(`/api/keywords/${id}/rankings?days=${days}`);
}

// --- Admin ---
export function getAdminStats() {
  return fetchApi<any>(`/api/admin/stats`, {
    headers: { "x-api-key": process.env.API_KEY || "" },
  });
}

export function getScraperRuns(limit = 20) {
  return fetchApi<any[]>(`/api/admin/scraper/runs?limit=${limit}`, {
    headers: { "x-api-key": process.env.API_KEY || "" },
  });
}

export async function addTrackedApp(slug: string) {
  return fetchApi<any>(`/api/admin/tracked-apps`, {
    method: "POST",
    body: JSON.stringify({ slug }),
  });
}

export async function removeTrackedApp(slug: string) {
  return fetchApi<any>(`/api/admin/tracked-apps/${slug}`, {
    method: "DELETE",
  });
}

export async function addTrackedKeyword(keyword: string) {
  return fetchApi<any>(`/api/admin/tracked-keywords`, {
    method: "POST",
    body: JSON.stringify({ keyword }),
  });
}

export async function removeTrackedKeyword(id: number) {
  return fetchApi<any>(`/api/admin/tracked-keywords/${id}`, {
    method: "DELETE",
  });
}

export async function triggerScraper(type: string) {
  return fetchApi<any>(`/api/admin/scraper/trigger`, {
    method: "POST",
    body: JSON.stringify({ type }),
  });
}
