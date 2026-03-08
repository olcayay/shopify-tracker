import { createLogger } from "@appranks/shared";
import type { NormalizedFeaturedSection } from "../../platform-module.js";
import { extractCanvaApps, type CanvaEmbeddedApp } from "./app-parser.js";
import { CANVA_FEATURED_SECTIONS } from "../constants.js";

const log = createLogger("canva-featured-parser");

/**
 * Parse featured sections from the Canva /apps page.
 *
 * The main page has featured sections like "Design with your favorite media",
 * "Enhance your images", "Supercharge your workflow". Since the visible sections
 * only show a subset of apps, we derive featured sections from the app order
 * in the embedded JSON.
 *
 * We also treat the visible "All apps" tab as a featured surface — the first
 * ~30 apps shown are effectively the "featured" apps.
 */
export function parseCanvaFeaturedSections(html: string): NormalizedFeaturedSection[] {
  const allApps = extractCanvaApps(html);
  const sections: NormalizedFeaturedSection[] = [];

  // Extract the first N apps as the "Featured" / "All apps" section
  // These are the apps that appear by default on the /apps page
  const featuredCount = Math.min(30, allApps.length);
  if (featuredCount > 0) {
    sections.push({
      sectionHandle: "all-apps",
      sectionTitle: "All Apps",
      surface: "apps-marketplace",
      surfaceDetail: "main-page",
      apps: allApps.slice(0, featuredCount).map((app, i) => ({
        slug: app.urlSlug ? `${app.id}/${app.urlSlug}` : app.id,
        name: app.name,
        iconUrl: app.iconUrl,
        position: i + 1,
      })),
    });
  }

  // Extract named featured sections from the page
  for (const sectionTitle of CANVA_FEATURED_SECTIONS) {
    const handle = sectionTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Find apps associated with this section in the page HTML
    // The section title appears as text, followed by app cards
    const sectionApps = extractSectionApps(html, sectionTitle, allApps);

    if (sectionApps.length > 0) {
      sections.push({
        sectionHandle: handle,
        sectionTitle,
        surface: "apps-marketplace",
        surfaceDetail: "featured-section",
        apps: sectionApps.map((app, i) => ({
          slug: app.urlSlug ? `${app.id}/${app.urlSlug}` : app.id,
          name: app.name,
          iconUrl: app.iconUrl,
          position: i + 1,
        })),
      });
    }
  }

  log.info("parsed canva featured sections", {
    sectionCount: sections.length,
    totalApps: sections.reduce((sum, s) => sum + s.apps.length, 0),
  });

  return sections;
}

/**
 * Extract apps associated with a named section in the HTML.
 *
 * The page structure has section headings followed by app card links.
 * We find the heading text and then extract nearby app IDs.
 */
function extractSectionApps(
  html: string,
  sectionTitle: string,
  allApps: CanvaEmbeddedApp[]
): CanvaEmbeddedApp[] {
  // Find the section heading in HTML
  const escapedTitle = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingIndex = html.search(new RegExp(escapedTitle));
  if (headingIndex === -1) return [];

  // Extract app IDs from the next ~5000 chars after the heading
  const section = html.substring(headingIndex, headingIndex + 5000);
  const appIdPattern = /\/apps\/(AA[A-Za-z][A-Za-z0-9_-]+)/g;
  const sectionAppIds = new Set<string>();

  let match;
  while ((match = appIdPattern.exec(section)) !== null) {
    sectionAppIds.add(match[1]);
  }

  // Map back to full app objects
  const appMap = new Map(allApps.map((a) => [a.id, a]));
  return Array.from(sectionAppIds)
    .map((id) => appMap.get(id))
    .filter((a): a is CanvaEmbeddedApp => a != null);
}
