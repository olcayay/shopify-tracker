/**
 * Google Search Console integration (PLA-344).
 *
 * Provides SEO monitoring via the Search Console API:
 * - Indexing status for public pages
 * - Search queries driving traffic
 * - Click-through rates per page
 *
 * Setup:
 * 1. Create a Google Cloud project
 * 2. Enable Search Console API
 * 3. Create a service account
 * 4. Add service account as a user in Search Console
 * 5. Set env vars:
 *    GSC_CLIENT_EMAIL=sa@project.iam.gserviceaccount.com
 *    GSC_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
 *    GSC_SITE_URL=https://appranks.io
 */
import { createLogger } from "@appranks/shared";

const log = createLogger("gsc");

export interface SearchAnalyticsRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface IndexingStatus {
  url: string;
  isIndexed: boolean;
  lastCrawled: string | null;
}

/**
 * Check if GSC is configured.
 */
export function isGSCConfigured(): boolean {
  return !!(
    process.env.GSC_CLIENT_EMAIL &&
    process.env.GSC_PRIVATE_KEY &&
    process.env.GSC_SITE_URL
  );
}

/**
 * Fetch search analytics data from Google Search Console.
 * Requires google-auth-library and googleapis packages.
 */
export async function getSearchAnalytics(
  startDate: string,
  endDate: string,
  options?: {
    dimensions?: string[];
    rowLimit?: number;
    pageFilter?: string;
    queryFilter?: string;
  }
): Promise<SearchAnalyticsRow[]> {
  if (!isGSCConfigured()) {
    log.warn("Google Search Console not configured");
    return [];
  }

  try {
    // Dynamic import — googleapis is an optional dependency
    // @ts-expect-error — optional peer dependency, may not be installed
    const googleapis: any = await import("googleapis").catch(() => null);
    // @ts-expect-error — optional peer dependency
    const googleAuth: any = await import("google-auth-library").catch(() => null);
    if (!googleapis || !googleAuth) {
      log.warn("googleapis or google-auth-library not installed");
      return [];
    }
    const { google } = googleapis;
    const { GoogleAuth } = googleAuth;

    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GSC_CLIENT_EMAIL,
        private_key: process.env.GSC_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });

    const searchConsole = google.searchconsole({ version: "v1", auth });
    const siteUrl = process.env.GSC_SITE_URL!;

    const dimensionFilterGroups = [];
    if (options?.pageFilter) {
      dimensionFilterGroups.push({
        filters: [{ dimension: "page", operator: "contains", expression: options.pageFilter }],
      });
    }
    if (options?.queryFilter) {
      dimensionFilterGroups.push({
        filters: [{ dimension: "query", operator: "contains", expression: options.queryFilter }],
      });
    }

    const response = await searchConsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: options?.dimensions || ["query", "page"],
        rowLimit: options?.rowLimit || 100,
        dimensionFilterGroups: dimensionFilterGroups.length > 0 ? dimensionFilterGroups : undefined,
      },
    });

    return (response.data.rows || []).map((row: any) => ({
      query: row.keys?.[0] || "",
      page: row.keys?.[1] || "",
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }));
  } catch (err) {
    log.error("GSC API error", { error: String(err) });
    return [];
  }
}

/**
 * Get top performing pages.
 */
export async function getTopPages(
  days: number = 28
): Promise<{ page: string; clicks: number; impressions: number; ctr: number; position: number }[]> {
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];

  const rows = await getSearchAnalytics(startDate, endDate, {
    dimensions: ["page"],
    rowLimit: 50,
  });

  return rows.map((r) => ({
    page: r.page || r.query,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

/**
 * Get top search queries driving traffic.
 */
export async function getTopQueries(
  days: number = 28
): Promise<{ query: string; clicks: number; impressions: number; ctr: number; position: number }[]> {
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];

  return getSearchAnalytics(startDate, endDate, {
    dimensions: ["query"],
    rowLimit: 100,
  });
}
