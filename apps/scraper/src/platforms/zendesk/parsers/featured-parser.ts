import * as cheerio from "cheerio";
import { createLogger } from "@appranks/shared";
import type { NormalizedFeaturedSection } from "../../platform-module.js";

const log = createLogger("zendesk:featured-parser");

/**
 * Parse featured sections from the Zendesk Marketplace homepage.
 *
 * The homepage displays curated collections like "Most Popular", "New & Noteworthy",
 * "Staff Picks", etc.
 *
 * URL: /marketplace/apps/
 */
export function parseZendeskFeaturedSections(html: string): NormalizedFeaturedSection[] {
  const $ = cheerio.load(html);
  const sections: NormalizedFeaturedSection[] = [];
  const appPattern = /\/marketplace\/apps\/([^/]+)\/(\d+)\/([^/?#]+)/;

  // Look for section headings followed by app cards
  $("h2, h3, [class*='section-title'], [class*='SectionTitle'], [class*='collection-title']").each((_i, el) => {
    const heading = $(el);
    const sectionTitle = heading.text().trim();
    if (!sectionTitle) return;

    // Skip generic/navigation headings
    if (sectionTitle.toLowerCase().includes("category") || sectionTitle.toLowerCase().includes("filter")) return;

    // Find sibling container with app cards
    const container = heading.next("[class*='grid'], [class*='list'], [class*='carousel'], ul, [class*='Grid'], [class*='List']").first()
      || heading.parent().find("[class*='grid'], [class*='list'], [class*='carousel'], ul").first();

    if (!container.length) return;

    const sectionApps: NormalizedFeaturedSection["apps"] = [];
    const seen = new Set<string>();

    container.find("a[href*='/marketplace/apps/']").each((_j, linkEl) => {
      const href = $(linkEl).attr("href") || "";
      const match = href.match(appPattern);
      if (!match) return;

      const [, , numericId, textSlug] = match;
      if (!numericId) return;

      const appSlug = `${numericId}--${textSlug}`;
      if (seen.has(appSlug)) return;
      seen.add(appSlug);

      const card = $(linkEl).closest("[class*='card'], [class*='Card'], li, article").first();
      const appContainer = card.length ? card : $(linkEl);

      const name = appContainer.find("h3, h4, [class*='title'], [class*='name']").first().text().trim()
        || textSlug.replace(/-/g, " ");

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
        surfaceDetail: "zendesk-marketplace-homepage",
        apps: sectionApps,
      });
    }
  });

  log.info("parsed featured sections", { sectionsFound: sections.length });

  return sections;
}
