import { createLogger } from "@appranks/shared";
import type { NormalizedFeaturedSection } from "../../platform-module.js";
import { ATLASSIAN_FEATURED_SECTIONS } from "../constants.js";

const log = createLogger("atlassian:featured-parser");

/**
 * Parse featured collections from multiple REST API responses.
 *
 * Each marketing label (Spotlight, Bestseller, Rising Star) returns addons
 * via GET /rest/2/addons?marketingLabel={label}
 *
 * @param responses Map of marketingLabel → JSON response
 */
export function parseAtlassianFeaturedSections(
  responses: Map<string, Record<string, any>>,
): NormalizedFeaturedSection[] {
  const sections: NormalizedFeaturedSection[] = [];

  for (const config of ATLASSIAN_FEATURED_SECTIONS) {
    const data = responses.get(config.marketingLabel);
    if (!data) continue;

    const addons = data._embedded?.addons || [];
    const apps = addons.map((addon: Record<string, any>, idx: number) => {
      const iconUrl = addon._embedded?.logo?._links?.image?.href || "";
      return {
        slug: addon.key || "",
        name: addon.name || "",
        iconUrl,
        position: idx + 1,
      };
    });

    if (apps.length > 0) {
      sections.push({
        sectionHandle: config.sectionHandle,
        sectionTitle: config.sectionTitle,
        surface: "home",
        surfaceDetail: `marketing_label_${config.marketingLabel.toLowerCase().replace(/\+/g, "_")}`,
        apps,
      });
    }

    log.info("parsed featured section", {
      label: config.marketingLabel,
      handle: config.sectionHandle,
      appCount: apps.length,
    });
  }

  return sections;
}
