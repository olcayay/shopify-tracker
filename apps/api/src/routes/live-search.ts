import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import * as cheerio from "cheerio";
import { sql } from "drizzle-orm";
import { getPlatformFromQuery } from "../utils/platform.js";
import type { FastifyInstance } from "fastify";
import { LIVE_SEARCH_LIMIT } from "../constants.js";

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

interface SearchApp {
  position: number;
  app_slug: string;
  app_name: string;
  short_description: string;
  average_rating: number;
  rating_count: number;
  logo_url?: string;
  is_sponsored: boolean;
  is_built_in: boolean;
  is_built_for_shopify: boolean;
}

interface SearchResult {
  totalResults: number;
  apps: SearchApp[];
  source?: string;
}

interface SearchContext {
  db: FastifyInstance["db"];
  keyword: string;
  request: FastifyRequest;
}

type LiveSearchHandler = (ctx: SearchContext) => Promise<SearchResult>;

// ---------------------------------------------------------------------------
// Helper: DB-based search (shared by platforms without a public search API)
// ---------------------------------------------------------------------------
function dbSearchForPlatform(platformName: string): LiveSearchHandler {
  return async ({ db, keyword }) => {
    const pattern = `%${keyword}%`;
    const rows = await db.execute(sql`
      SELECT slug, name, icon_url, app_card_subtitle
      FROM apps
      WHERE platform = ${platformName}
        AND (name ILIKE ${pattern} OR slug ILIKE ${pattern} OR app_card_subtitle ILIKE ${pattern})
      ORDER BY
        CASE WHEN name ILIKE ${keyword} THEN 0
             WHEN name ILIKE ${keyword + '%'} THEN 1
             ELSE 2 END,
        name
      LIMIT ${LIVE_SEARCH_LIMIT}
    `);
    const results: SearchApp[] = (rows as any[]).map((r: any, idx: number) => ({
      position: idx + 1,
      app_slug: r.slug,
      app_name: r.name,
      short_description: r.app_card_subtitle || "",
      average_rating: 0,
      rating_count: 0,
      logo_url: r.icon_url || undefined,
      is_sponsored: false,
      is_built_in: false,
      is_built_for_shopify: false,
    }));
    return { totalResults: results.length, apps: results, source: "database" };
  };
}

// ---------------------------------------------------------------------------
// Platform-specific search implementations
// ---------------------------------------------------------------------------

function parseShopifySearchResults(html: string) {
  const $ = cheerio.load(html);

  const bodyText = $.text();
  const totalMatch =
    bodyText.match(/(\d[\d,]*)\s+results?\s+for/i) ||
    bodyText.match(/(\d[\d,]*)\s+apps?\b/i);
  const totalResults = totalMatch
    ? parseInt(totalMatch[1].replace(/,/g, ""), 10)
    : null;

  const apps: SearchApp[] = [];
  const seenSlugs = new Set<string>();
  let position = 0;

  $('[data-controller="app-card"]').each((_, el) => {
    const $card = $(el);
    const appSlug = $card.attr("data-app-card-handle-value") || "";
    const appName = ($card.attr("data-app-card-name-value") || "").trim();
    const appLink = $card.attr("data-app-card-app-link-value") || "";

    if (!appSlug || !appName) return;
    if (seenSlugs.has(appSlug)) return;
    seenSlugs.add(appSlug);

    const isBuiltIn = appSlug.startsWith("bif:");
    const isSponsored = !isBuiltIn && appLink.includes("surface_type=search_ad");
    const isBuiltForShopify = $card.find('[class*="built-for-shopify"]').length > 0;
    if (!isSponsored && !isBuiltIn) position++;

    const cardText = $card.text();
    const ratingMatch = cardText.match(/(\d\.\d)\s*out of 5 stars/);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
    const countMatch =
      cardText.match(/\(([\d,]+)\)\s*[\d,]*\s*total reviews/) ||
      cardText.match(/([\d,]+)\s*total reviews/);
    const ratingCount = countMatch
      ? parseInt(countMatch[1].replace(/,/g, ""), 10)
      : 0;

    let shortDescription = "";
    $card.find("p").each((_, pEl) => {
      const text = cheerio.load(pEl)("p").text().trim();
      if (
        text.length > 10 &&
        text.length > shortDescription.length &&
        !text.includes("out of 5 stars") &&
        !text.includes("total reviews") &&
        !text.includes("paid search") &&
        !text.includes("highest standards")
      ) {
        shortDescription = text;
      }
    });

    apps.push({
      position: isSponsored || isBuiltIn ? 0 : position,
      app_slug: appSlug,
      app_name: appName,
      short_description: shortDescription,
      average_rating: rating,
      rating_count: ratingCount,
      is_sponsored: isSponsored,
      is_built_in: isBuiltIn,
      is_built_for_shopify: isBuiltForShopify,
    });
  });

  return { totalResults, apps };
}

const shopifySearch: LiveSearchHandler = async ({ keyword }) => {
  const url = `https://apps.shopify.com/search?q=${encodeURIComponent(keyword)}&st_source=autocomplete&page=1`;
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  const response = await fetch(url, {
    headers: {
      "User-Agent": ua,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Turbo-Frame": "search_page",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Shopify returned ${response.status}`);
  }

  const html = await response.text();
  const result = parseShopifySearchResults(html);
  return { totalResults: result.totalResults ?? 0, apps: result.apps, source: "shopify-html" };
};

const salesforceSearch: LiveSearchHandler = async ({ keyword }) => {
  const API_BASE = "https://api.appexchange.salesforce.com/recommendations/v3/listings";
  const params = new URLSearchParams({
    type: "apps",
    page: "0",
    pageSize: "12",
    language: "en",
    keyword,
    sponsoredCount: "4",
  });
  const url = `${API_BASE}?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "x-use-new-search": "true",
      Origin: "https://appexchange.salesforce.com",
      Referer: "https://appexchange.salesforce.com/",
      "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    },
  });

  if (!response.ok) {
    throw new Error(`Salesforce API returned ${response.status}`);
  }

  const data = await response.json() as {
    totalCount: number;
    listings: any[];
    featured?: any[];
  };

  const apps: SearchApp[] = [];

  if (data.featured) {
    for (let i = 0; i < data.featured.length; i++) {
      const item = data.featured[i];
      const logo = item.logos?.find((l: any) => l.logoType === "Logo") || item.logos?.[0];
      apps.push({
        position: i + 1,
        app_slug: item.oafId,
        app_name: item.title,
        short_description: item.description || "",
        average_rating: item.averageRating ?? 0,
        rating_count: item.reviewsAmount ?? 0,
        logo_url: logo?.mediaId || undefined,
        is_sponsored: true,
        is_built_in: false,
        is_built_for_shopify: false,
      });
    }
  }

  for (let i = 0; i < data.listings.length; i++) {
    const item = data.listings[i];
    const logo = item.logos?.find((l: any) => l.logoType === "Logo") || item.logos?.[0];
    apps.push({
      position: i + 1,
      app_slug: item.oafId,
      app_name: item.title,
      short_description: item.description || "",
      average_rating: item.averageRating ?? 0,
      rating_count: item.reviewsAmount ?? 0,
      logo_url: logo?.mediaId || undefined,
      is_sponsored: false,
      is_built_in: false,
      is_built_for_shopify: false,
    });
  }

  return { totalResults: data.totalCount, apps, source: "api" };
};

const CANVA_SEARCH_SERVER = process.env.CANVA_SEARCH_URL || "http://localhost:3002";

const canvaSearch: LiveSearchHandler = async ({ db, keyword, request }) => {
  // Try live search via browser-based search server, fall back to DB
  try {
    const url = `${CANVA_SEARCH_SERVER}/canva-search?q=${encodeURIComponent(keyword)}`;
    request.log.info({ platform: "canva", keyword, server: CANVA_SEARCH_SERVER }, "live-search trying Canva search server");
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      throw new Error(`Search server returned ${response.status}`);
    }
    const result = await response.json() as SearchResult;
    return { ...result, source: result.source || "live" };
  } catch (liveErr: any) {
    request.log.warn({ platform: "canva", keyword, error: liveErr.message }, "live-search Canva search server unavailable, falling back to database");
    return dbSearchForPlatform("canva")({ db, keyword, request });
  }
};

const wixSearch: LiveSearchHandler = async ({ keyword }) => {
  const url = `https://www.wix.com/app-market/search-result?query=${encodeURIComponent(keyword)}`;
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  const response = await fetch(url, {
    headers: {
      "User-Agent": ua,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Wix returned ${response.status}`);
  }

  const html = await response.text();

  const match = html.match(
    /window\.__REACT_QUERY_STATE__\s*=\s*JSON\.parse\(__decodeBase64\('([^']+)'\)\)/
  );
  if (!match) {
    throw new Error("Could not find __REACT_QUERY_STATE__ in Wix HTML");
  }

  const decoded = Buffer.from(match[1], "base64").toString("utf-8");
  const state = JSON.parse(decoded);

  let data: any = null;
  for (const q of state.queries ?? []) {
    const key = Array.isArray(q.queryKey) ? q.queryKey[0] : q.queryKey;
    if (typeof key === "string" && key.startsWith("initial-apps-fetch-")) {
      data = q.state?.data;
      break;
    }
  }

  if (!data) {
    return { totalResults: 0, apps: [], source: "html" };
  }

  const rawApps = data.appGroup?.apps ?? [];
  const totalResults = data.paging?.total ?? rawApps.length;

  const apps: SearchApp[] = rawApps.map((app: any, index: number) => ({
    position: index + 1,
    app_slug: app.slug || "",
    app_name: app.name || "",
    short_description: app.shortDescription || "",
    average_rating: app.reviews?.averageRating ?? 0,
    rating_count: app.reviews?.totalCount ?? 0,
    logo_url: app.icon || undefined,
    is_sponsored: false,
    is_built_in: false,
    is_built_for_shopify: false,
  }));

  return { totalResults, apps, source: "html" };
};

const atlassianSearch: LiveSearchHandler = async ({ keyword }) => {
  const apiUrl = `https://marketplace.atlassian.com/rest/2/addons?text=${encodeURIComponent(keyword)}&limit=10`;
  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    },
  });
  if (!response.ok) {
    throw new Error(`Atlassian API returned ${response.status}`);
  }
  const data = await response.json() as { count?: number; _embedded?: { addons?: any[] } };
  const addons = data._embedded?.addons || [];
  const apps: SearchApp[] = addons.map((addon: any, idx: number) => ({
    position: idx + 1,
    app_slug: addon.key || "",
    app_name: addon.name || "",
    short_description: addon.summary ? addon.summary.replace(/<[^>]*>/g, "") : "",
    average_rating: addon._embedded?.reviews?.averageStars ?? 0,
    rating_count: addon._embedded?.reviews?.count ?? 0,
    logo_url: addon._embedded?.logo?._links?.image?.href || undefined,
    is_sponsored: false,
    is_built_in: false,
    is_built_for_shopify: false,
  }));
  return { totalResults: data.count ?? apps.length, apps, source: "api" };
};

const zoomSearch: LiveSearchHandler = async ({ keyword }) => {
  const apiUrl = `https://marketplace.zoom.us/api/v1/apps/search?q=${encodeURIComponent(keyword)}&pageNum=1&pageSize=10`;
  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    },
  });
  if (!response.ok) {
    throw new Error(`Zoom API returned ${response.status}`);
  }
  const data = await response.json() as { total?: number; apps?: any[] };
  const apps: SearchApp[] = (data.apps || []).map((app: any, idx: number) => ({
    position: idx + 1,
    app_slug: app.id || "",
    app_name: app.displayName || app.name || "",
    short_description: app.description || "",
    average_rating: app.ratingStatistics?.averageRating ?? 0,
    rating_count: app.ratingStatistics?.totalRatings ?? 0,
    logo_url: app.icon ? (app.icon.startsWith("http") ? app.icon : `https://marketplacecontent-cf.zoom.us/${encodeURIComponent(app.icon)}`) : undefined,
    is_sponsored: false,
    is_built_in: false,
    is_built_for_shopify: false,
  }));
  return { totalResults: data.total ?? apps.length, apps, source: "api" };
};

const wordpressSearch: LiveSearchHandler = async ({ keyword }) => {
  const apiUrl = `https://api.wordpress.org/plugins/info/1.2/?action=query_plugins&search=${encodeURIComponent(keyword)}&per_page=10`;
  const response = await fetch(apiUrl, {
    headers: { "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] },
  });
  if (!response.ok) {
    throw new Error(`WordPress API returned ${response.status}`);
  }
  const data = await response.json() as { info: { results: number }; plugins: any[] };
  const apps: SearchApp[] = (data.plugins || []).map((p: any, idx: number) => ({
    position: idx + 1,
    app_slug: p.slug || "",
    app_name: (p.name || "").replace(/<[^>]*>/g, ""),
    short_description: (p.short_description || "").replace(/<[^>]*>/g, ""),
    average_rating: typeof p.rating === "number" ? p.rating / 20 : 0,
    rating_count: p.num_ratings ?? 0,
    logo_url: p.icons?.["2x"] || p.icons?.["1x"] || undefined,
    is_sponsored: false,
    is_built_in: false,
    is_built_for_shopify: false,
  }));
  return { totalResults: data.info?.results ?? apps.length, apps, source: "api" };
};

// ---------------------------------------------------------------------------
// Registry: platform → search handler
// New platforms just add an entry here.
// ---------------------------------------------------------------------------
const liveSearchRegistry: Record<string, LiveSearchHandler> = {
  shopify: shopifySearch,
  salesforce: salesforceSearch,
  canva: canvaSearch,
  wix: wixSearch,
  wordpress: wordpressSearch,
  google_workspace: dbSearchForPlatform("google_workspace"),
  atlassian: atlassianSearch,
  zoom: zoomSearch,
  zoho: dbSearchForPlatform("zoho"),
  zendesk: dbSearchForPlatform("zendesk"),
  hubspot: dbSearchForPlatform("hubspot"),
};

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export const liveSearchRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/live-search?q=keyword — real-time search
  app.get("/", async (request, reply) => {
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);
    const { q = "" } = request.query as { q?: string };
    if (q.length < 1) {
      return reply.code(400).send({ error: "q parameter is required" });
    }

    const start = Date.now();
    request.log.info({ platform, keyword: q }, "live-search started");

    const handler = liveSearchRegistry[platform] ?? liveSearchRegistry.shopify;

    try {
      const result = await handler({ db, keyword: q, request });
      request.log.info(
        { platform, keyword: q, source: result.source, apps: result.apps.length, totalResults: result.totalResults, ms: Date.now() - start },
        "live-search completed"
      );
      return { keyword: q, totalResults: result.totalResults, apps: result.apps, ...(result.source ? { source: result.source } : {}) };
    } catch (err: any) {
      request.log.error({ platform, keyword: q, error: err.message, ms: Date.now() - start }, "live-search failed");
      return reply.code(502).send({ error: `Failed to fetch from ${platform}: ${err.message}` });
    }
  });
};
