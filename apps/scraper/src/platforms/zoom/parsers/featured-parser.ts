import { createLogger } from "@appranks/shared";
import type { NormalizedFeaturedSection } from "../../platform-module.js";
import { ZOOM_FEATURED_SECTIONS } from "../constants.js";
import { zoomUrls } from "../urls.js";

const log = createLogger("zoom:featured-parser");

/**
 * Parse Zoom curated/featured sections from the preview API response.
 *
 * Source: GET /api/v1/curatedCategory/preview/excludeBanner
 * Returns a dict keyed by curated category IDs, each containing
 * name, seoId, appCount, previewAppList, etc.
 */
export function parseZoomFeaturedSections(
  data: Record<string, Record<string, any>>,
): NormalizedFeaturedSection[] {
  const sections: NormalizedFeaturedSection[] = [];

  // Build a lookup by seoId for matching with our config
  const bySeoId = new Map<string, Record<string, any>>();
  for (const section of Object.values(data)) {
    if (section.seoId) {
      bySeoId.set(section.seoId, section);
    }
  }

  for (const config of ZOOM_FEATURED_SECTIONS) {
    const section = bySeoId.get(config.seoId);
    if (!section) continue;

    const previewApps = section.previewAppList || [];
    const apps = previewApps.map((app: Record<string, any>, idx: number) => {
      const iconUrl = app.icon ? zoomUrls.iconUrl(app.icon) : "";
      return {
        slug: app.id || "",
        name: app.displayName || app.name || "",
        iconUrl,
        position: idx + 1,
      };
    });

    if (apps.length > 0) {
      sections.push({
        sectionHandle: config.sectionHandle,
        sectionTitle: config.sectionTitle,
        surface: "home",
        surfaceDetail: `curated_${config.seoId}`,
        apps,
      });
    }

    log.info("parsed featured section", {
      seoId: config.seoId,
      handle: config.sectionHandle,
      appCount: apps.length,
      totalAppCount: section.appCount,
    });
  }

  return sections;
}
