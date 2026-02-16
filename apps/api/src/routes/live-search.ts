import type { FastifyPluginAsync } from "fastify";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

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
  is_sponsored: boolean;
  is_built_in: boolean;
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
    });
  });

  return { totalResults, apps };
}

export const liveSearchRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/live-search?q=keyword — real-time Shopify search
  app.get("/", async (request, reply) => {
    const { q = "" } = request.query as { q?: string };
    if (q.length < 1) {
      return reply.code(400).send({ error: "q parameter is required" });
    }

    const url = `https://apps.shopify.com/search?q=${encodeURIComponent(q)}&st_source=autocomplete&page=1`;
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    try {
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
        return reply
          .code(502)
          .send({ error: `Shopify returned ${response.status}` });
      }

      const html = await response.text();
      const result = parseSearchResults(html);

      return {
        keyword: q,
        totalResults: result.totalResults,
        apps: result.apps,
      };
    } catch (err: any) {
      return reply
        .code(502)
        .send({ error: `Failed to fetch from Shopify: ${err.message}` });
    }
  });
};
