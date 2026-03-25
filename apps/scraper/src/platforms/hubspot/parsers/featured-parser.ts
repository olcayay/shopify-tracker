import { createLogger } from "@appranks/shared";
import type { NormalizedFeaturedSection } from "../../platform-module.js";

const log = createLogger("hubspot:featured-parser");

/**
 * Parse featured sections from CHIRP API responses.
 *
 * Input: JSON string with `{ collections, suggestions }` envelope,
 * where `collections` comes from CollectionsPublicRpc/getCollections
 * and `suggestions` comes from PersonalizationPublicRpc/getSuggestionSections.
 */
export function parseHubSpotFeaturedSections(json: string): NormalizedFeaturedSection[] {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    log.warn("failed to parse featured JSON");
    return [];
  }

  const sections: NormalizedFeaturedSection[] = [];

  // Parse collections
  const collections: any[] = data?.collections ?? [];
  for (const col of collections) {
    const items: any[] = col.previewItems || [];
    if (!items.length) continue;

    const sectionHandle = col.slug || String(col.id);
    sections.push({
      sectionHandle,
      sectionTitle: col.title || col.name || sectionHandle,
      surface: "collection",
      surfaceDetail: `hubspot-collection-${sectionHandle}`,
      apps: items.map((item: any, idx: number) => ({
        slug: item.slug || "",
        name: item.name || item.slug || "",
        iconUrl: item.iconUrl || "",
        position: idx + 1,
      })),
    });
  }

  // Parse suggestion sections
  const suggestions: any[] = data?.suggestions ?? [];
  for (const sec of suggestions) {
    const cards: any[] = sec.cards || [];
    if (!cards.length) continue;

    const sectionHandle = (sec.title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    sections.push({
      sectionHandle,
      sectionTitle: sec.title || sectionHandle,
      surface: "homepage",
      surfaceDetail: "hubspot-marketplace-homepage",
      apps: cards.map((card: any, idx: number) => ({
        slug: card.slug || "",
        name: card.listingName || card.slug || "",
        iconUrl: card.iconUrl || "",
        position: idx + 1,
      })),
    });
  }

  log.info("parsed featured sections from CHIRP", { sectionsFound: sections.length });

  return sections;
}
