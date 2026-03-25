import * as cheerio from "cheerio";
import { createLogger } from "@appranks/shared";
import type { NormalizedFeaturedSection } from "../../platform-module.js";

const log = createLogger("hubspot:featured-parser");

/**
 * Parse featured sections from the HubSpot App Marketplace homepage.
 *
 * The homepage displays curated collections/featured sections.
 * URL: /marketplace or /marketplace/featured/{collectionSlug}
 */
export function parseHubSpotFeaturedSections(html: string): NormalizedFeaturedSection[] {
  const $ = cheerio.load(html);
  const sections: NormalizedFeaturedSection[] = [];
  const appPattern = /\/marketplace\/listing\/([^/?#]+)/;

  // Look for section headings followed by app cards
  $("h2, h3, [class*='section-title'], [class*='SectionTitle'], [class*='collection-title'], [class*='CollectionTitle']").each((_i, el) => {
    const heading = $(el);
    const sectionTitle = heading.text().trim();
    if (!sectionTitle) return;

    // Skip generic/navigation headings
    const lower = sectionTitle.toLowerCase();
    if (lower.includes("category") || lower.includes("filter") || lower.includes("browse")) return;

    // Find sibling/nearby container with app cards
    const container = heading.next("[class*='grid'], [class*='list'], [class*='carousel'], ul, [class*='Grid'], [class*='List']").first()
      || heading.parent().find("[class*='grid'], [class*='list'], [class*='carousel'], ul").first();

    if (!container.length) return;

    const sectionApps: NormalizedFeaturedSection["apps"] = [];
    const seen = new Set<string>();

    container.find("a[href*='/marketplace/listing/']").each((_j, linkEl) => {
      const href = $(linkEl).attr("href") || "";
      const match = href.match(appPattern);
      if (!match) return;

      const appSlug = match[1];
      if (seen.has(appSlug)) return;
      seen.add(appSlug);

      const card = $(linkEl).closest("[class*='card'], [class*='Card'], li, article").first();
      const appContainer = card.length ? card : $(linkEl);

      const name = appContainer.find("h3, h4, [class*='title'], [class*='name'], [class*='Title'], [class*='Name']").first().text().trim()
        || appSlug.replace(/-/g, " ");

      const iconUrl = appContainer.find("img").first().attr("src") || "";

      sectionApps.push({
        slug: appSlug,
        name,
        iconUrl,
        position: sectionApps.length + 1,
      });
    });

    if (sectionApps.length > 0) {
      const sectionHandle = sectionTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      sections.push({
        sectionHandle,
        sectionTitle,
        surface: "homepage",
        surfaceDetail: "hubspot-marketplace-homepage",
        apps: sectionApps,
      });
    }
  });

  log.info("parsed featured sections", { sectionsFound: sections.length });

  return sections;
}
