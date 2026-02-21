import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { createLogger } from "@shopify-tracking/shared";

const log = createLogger("featured-parser");

export interface FeaturedSection {
  sectionHandle: string;
  sectionTitle: string;
  surface: string;
  surfaceDetail: string;
  apps: FeaturedApp[];
}

export interface FeaturedApp {
  slug: string;
  name: string;
  iconUrl: string;
  position: number | null;
}

// Handles to exclude: editorial, non-app, and Shopify's own promotional sections
const EXCLUDED_HANDLES = new Set([
  "shopify-apps",          // "Made by Shopify" — Shopify promoting its own apps
  "TestimonialComponent",  // Testimonial quotes with single app
  "story-page-crosslink",  // Editorial story cross-links
  "home",                  // Homepage editorial sections (tech stack, CTA, etc.)
  "category",              // Category CTA sections
]);

/**
 * Parse all featured app sections from a Shopify page.
 * Works for homepage, L1 category, and L2 category pages.
 *
 * Sections are identified by `data-monorail-waypoint="AppStoreSurfaceWaypoint"` containers
 * with `data-waypoint-app-grouping-handle` attributes.
 */
export function parseFeaturedSections(html: string): FeaturedSection[] {
  const $ = cheerio.load(html);
  const sections: FeaturedSection[] = [];
  const seenKeys = new Set<string>();

  $('[data-monorail-waypoint="AppStoreSurfaceWaypoint"]').each((_, el) => {
    const $el = $(el);
    const handle = $el.attr("data-waypoint-app-grouping-handle");
    const surface = $el.attr("data-waypoint-surface");
    const surfaceDetail = $el.attr("data-waypoint-surface-detail") || "";

    if (!handle || !surface) return;

    // Skip excluded section types
    if (EXCLUDED_HANDLES.has(handle)) return;

    // Find app cards within this waypoint
    const $cards = $el.find('[data-controller="app-card"]');
    if ($cards.length === 0) return;

    const sectionKey = `${surface}:${surfaceDetail}:${handle}`;

    // If we already saw this section, append apps to it
    if (seenKeys.has(sectionKey)) {
      const existing = sections.find(
        (s) =>
          s.sectionHandle === handle &&
          s.surfaceDetail === surfaceDetail &&
          s.surface === surface
      );
      if (existing) {
        const newApps = parseCards($, $el, existing.apps.map((a) => a.slug));
        existing.apps.push(...newApps);
      }
      return;
    }
    seenKeys.add(sectionKey);

    // Extract section title from nearest h2/h3
    const sectionTitle = extractTitle($, $el);
    const apps = parseCards($, $el, []);

    sections.push({
      sectionHandle: handle,
      sectionTitle: sectionTitle || handle,
      surface,
      surfaceDetail: surfaceDetail || (surface === "home" ? "home" : ""),
      apps,
    });
  });

  log.info("parsed featured sections", {
    sectionCount: sections.length,
    totalApps: sections.reduce((sum, s) => sum + s.apps.length, 0),
  });

  return sections;
}

function parseCards(
  $: cheerio.CheerioAPI,
  $container: cheerio.Cheerio<AnyNode>,
  existingSlugs: string[]
): FeaturedApp[] {
  const apps: FeaturedApp[] = [];
  const seen = new Set(existingSlugs);

  $container.find('[data-controller="app-card"]').each((_, el) => {
    const $card = $(el);
    const slug = $card.attr("data-app-card-handle-value") || "";
    const name = ($card.attr("data-app-card-name-value") || "").trim();
    const iconUrl = $card.attr("data-app-card-icon-url-value") || "";
    const intraPosition = $card.attr("data-app-card-intra-position-value");

    if (!slug || !name) return;
    if (seen.has(slug)) return;
    seen.add(slug);

    apps.push({
      slug,
      name,
      iconUrl,
      position: intraPosition ? parseInt(intraPosition, 10) : null,
    });
  });

  return apps;
}

function extractTitle(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<AnyNode>
): string {
  // Look for h2/h3 inside the element
  const inner = $el.find("h2, h3").first().text().trim();
  if (inner) return inner;

  // Look for heading as previous sibling
  const prev = $el.prev("h2, h3");
  if (prev.length) return prev.text().trim();

  // Look in parent
  const parentH = $el.parent().children("h2, h3").first().text().trim();
  if (parentH && parentH.length < 100) return parentH;

  return "";
}
