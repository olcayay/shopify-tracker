import type { FastifyPluginAsync } from "fastify";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { sql } from "drizzle-orm";
import { createDb } from "@appranks/db";
import { getPlatformFromQuery } from "../utils/platform.js";

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

function parseSearchResults(html: string) {
  const $ = cheerio.load(html);

  // Total results
  const bodyText = $.text();
  const totalMatch =
    bodyText.match(/(\d[\d,]*)\s+results?\s+for/i) ||
    bodyText.match(/(\d[\d,]*)\s+apps?\b/i);
  const totalResults = totalMatch
    ? parseInt(totalMatch[1].replace(/,/g, ""), 10)
    : null;

  // App cards
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
    // Only increment position for organic (non-sponsored, non-built-in) results
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

    // Extract description from <p> tags
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

async function salesforceLiveSearch(keyword: string) {
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

  // Sponsored/featured
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

  // Organic
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

  return { totalResults: data.totalCount, apps };
}

const CANVA_SEARCH_SERVER = process.env.CANVA_SEARCH_URL || "http://localhost:3002";

/**
 * Live search Canva via the browser-based search micro-server.
 * Falls back to DB search if the server is unavailable.
 */
async function canvaLiveSearch(keyword: string): Promise<{ totalResults: number; apps: SearchApp[]; source: string }> {
  const url = `${CANVA_SEARCH_SERVER}/canva-search?q=${encodeURIComponent(keyword)}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Search server returned ${response.status}`);
  }
  return response.json() as any;
}

/**
 * Search Canva apps from our database (fallback when search server is unavailable).
 */
async function canvaDbSearch(db: ReturnType<typeof createDb>, keyword: string): Promise<{ totalResults: number; apps: SearchApp[] }> {
  const pattern = `%${keyword}%`;
  const rows = await db.execute(sql`
    SELECT slug, name, icon_url, app_card_subtitle
    FROM apps
    WHERE platform = 'canva'
      AND (name ILIKE ${pattern} OR slug ILIKE ${pattern} OR app_card_subtitle ILIKE ${pattern})
    ORDER BY
      CASE WHEN name ILIKE ${keyword} THEN 0
           WHEN name ILIKE ${keyword + '%'} THEN 1
           ELSE 2 END,
      name
    LIMIT 50
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
  return { totalResults: results.length, apps: results };
}

export const liveSearchRoutes: FastifyPluginAsync = async (app) => {
  const db: ReturnType<typeof createDb> = (app as any).db;

  // GET /api/live-search?q=keyword — real-time search
  app.get("/", async (request, reply) => {
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);
    const { q = "" } = request.query as { q?: string };
    if (q.length < 1) {
      return reply.code(400).send({ error: "q parameter is required" });
    }

    const start = Date.now();
    request.log.info({ platform, keyword: q }, "live-search started");

    if (platform === "salesforce") {
      try {
        const result = await salesforceLiveSearch(q);
        request.log.info({ platform, keyword: q, source: "api", apps: result.apps.length, ms: Date.now() - start }, "live-search completed via Salesforce API");
        return { keyword: q, totalResults: result.totalResults, apps: result.apps };
      } catch (err: any) {
        request.log.error({ platform, keyword: q, error: err.message, ms: Date.now() - start }, "live-search failed");
        return reply.code(502).send({ error: `Failed to fetch from Salesforce: ${err.message}` });
      }
    }

    if (platform === "canva") {
      // Try live search via browser-based search server, fall back to DB
      try {
        request.log.info({ platform, keyword: q, server: CANVA_SEARCH_SERVER }, "live-search trying Canva search server");
        const result = await canvaLiveSearch(q);
        request.log.info({ platform, keyword: q, source: "live", apps: result.apps.length, totalResults: result.totalResults, ms: Date.now() - start }, "live-search completed via Canva search server (Playwright browser)");
        return { keyword: q, totalResults: result.totalResults, apps: result.apps, source: result.source || "live" };
      } catch (liveErr: any) {
        request.log.warn({ platform, keyword: q, error: liveErr.message, ms: Date.now() - start }, "live-search Canva search server unavailable, falling back to database");
        try {
          const result = await canvaDbSearch(db, q);
          request.log.info({ platform, keyword: q, source: "database", apps: result.apps.length, ms: Date.now() - start }, "live-search completed via database fallback");
          return { keyword: q, totalResults: result.totalResults, apps: result.apps, source: "database" };
        } catch (err: any) {
          request.log.error({ platform, keyword: q, error: err.message, ms: Date.now() - start }, "live-search database fallback also failed");
          return reply.code(502).send({ error: `Failed to search Canva apps: ${err.message}` });
        }
      }
    }

    // Default: Shopify
    const url = `https://apps.shopify.com/search?q=${encodeURIComponent(q)}&st_source=autocomplete&page=1`;
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    try {
      request.log.info({ platform, keyword: q, source: "shopify-html" }, "live-search fetching Shopify search page");
      const response = await fetch(url, {
        headers: {
          "User-Agent": ua,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Turbo-Frame": "search_page",
        },
        redirect: "follow",
      });

      if (!response.ok) {
        request.log.error({ platform, keyword: q, status: response.status, ms: Date.now() - start }, "live-search Shopify returned error");
        return reply
          .code(502)
          .send({ error: `Shopify returned ${response.status}` });
      }

      const html = await response.text();
      const result = parseSearchResults(html);

      request.log.info({ platform, keyword: q, source: "shopify-html", apps: result.apps.length, totalResults: result.totalResults, ms: Date.now() - start }, "live-search completed via Shopify HTML scrape");
      return {
        keyword: q,
        totalResults: result.totalResults,
        apps: result.apps,
      };
    } catch (err: any) {
      request.log.error({ platform, keyword: q, error: err.message, ms: Date.now() - start }, "live-search failed");
      return reply
        .code(502)
        .send({ error: `Failed to fetch from Shopify: ${err.message}` });
    }
  });
};
