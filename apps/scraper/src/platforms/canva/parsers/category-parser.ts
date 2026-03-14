import { createLogger } from "@appranks/shared";
import type { NormalizedCategoryPage, NormalizedCategoryApp } from "../../platform-module.js";
import { extractCanvaApps, type CanvaEmbeddedApp } from "./app-parser.js";
import { CANVA_FILTER_LABELS, CANVA_SUBCATEGORY_LABELS } from "../constants.js";

const log = createLogger("canva-category-parser");

/**
 * Mapping from filter category slugs to the marketplace_topic.* tags
 * that belong to each filter category.
 */
export const CATEGORY_TOPIC_MAP: Record<string, string[]> = {
  "ai-generation": [
    "marketplace_topic.ai_images",
    "marketplace_topic.ai_audio",
    "marketplace_topic.ai_videos",
    "marketplace_topic.ai_text",
    "marketplace_topic.ai_documents",
  ],
  "audio-and-voiceover": [
    "marketplace_topic.music",
    "marketplace_topic.voiceovers",
    "marketplace_topic.sound_effects",
  ],
  "communication": [
    "marketplace_topic.social_networking",
    "marketplace_topic.email",
    "marketplace_topic.display",
  ],
  "file-and-data-management": [
    "marketplace_topic.file_import_and_export",
    "marketplace_topic.file_converters",
    "marketplace_topic.data_connectors",
    "marketplace_topic.data_visualization",
  ],
  "graphic-design": [
    "marketplace_topic.icons_and_illustrations",
    "marketplace_topic.shapes",
    "marketplace_topic.frames",
    "marketplace_topic.patterns",
    "marketplace_topic.mockups",
    "marketplace_topic.logos",
  ],
  "marketing": [
    "marketplace_topic.content_schedulers",
    "marketplace_topic.analytics",
    "marketplace_topic.ads",
  ],
  "photo-editing": [
    "marketplace_topic.photo_effects",
    "marketplace_topic.images",
    "marketplace_topic.styles",
    "marketplace_topic.color",
  ],
  "project-management": [
    "marketplace_topic.tasks_and_workflows",
    "marketplace_topic.documents",
    "marketplace_topic.forms",
    "marketplace_topic.interactivity",
  ],
  "text-styling": [
    "marketplace_topic.text_effects",
    "marketplace_topic.text_generators",
    "marketplace_topic.forms",
  ],
  "video-and-animation": [
    "marketplace_topic.videos",
    "marketplace_topic.video_effects",
    "marketplace_topic.animation",
    "marketplace_topic.subtitles",
    "marketplace_topic.flipbooks",
  ],
};

/**
 * Convert a marketplace_topic tag to a sub-category slug.
 * e.g. "marketplace_topic.ai_images" → "ai-images"
 */
function topicTagToSlug(tag: string): string {
  return tag.replace("marketplace_topic.", "").replace(/_/g, "-");
}

/**
 * Parse the Canva /apps page HTML to extract category data.
 *
 * Two modes based on the slug:
 *
 * 1. **Hub page** (slug is a filter category like "project-management"):
 *    Returns `appCount: null`, empty `apps`, populated `subcategoryLinks`.
 *
 * 2. **Listing page** (slug is a topic sub-category like "forms"):
 *    Filters apps by exact single topic tag, returns ranked apps.
 */
export function parseCanvaCategoryPage(
  html: string,
  categorySlug: string,
  page: number,
  organicOffset: number
): NormalizedCategoryPage {
  const topicFilters = CATEGORY_TOPIC_MAP[categorySlug];

  // --- Hub page: filter category with sub-topics ---
  if (topicFilters) {
    const subcategoryLinks = topicFilters.map((tag) => {
      const topicSlug = topicTagToSlug(tag);
      return {
        slug: topicSlug,
        url: `https://www.canva.com/apps?category=${categorySlug}&topic=${topicSlug}`,
        title: CANVA_SUBCATEGORY_LABELS[topicSlug] || topicSlug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
        parentSlug: categorySlug,
      };
    });

    const title = CANVA_FILTER_LABELS[categorySlug] || categorySlug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    log.info("hub category page", { categorySlug, subcategories: subcategoryLinks.length });

    return {
      slug: categorySlug,
      url: `https://www.canva.com/apps?category=${categorySlug}`,
      title,
      description: "",
      appCount: null,         // Hub page — no direct rankings
      apps: [],               // Hub page — no apps
      subcategoryLinks,
      hasNextPage: false,
    };
  }

  // --- Listing page: topic sub-category ---
  // Slug is the simple topic slug (e.g., "forms")
  const topicSlug = categorySlug;
  const allApps = extractCanvaApps(html);
  const topicTag = `marketplace_topic.${topicSlug.replace(/-/g, "_")}`;
  const filteredApps = allApps.filter((app) =>
    app.topics.some((t) => t === topicTag)
  );

  log.info("listing category page", {
    categorySlug,
    topicSlug,
    topicTag,
    total: allApps.length,
    matched: filteredApps.length,
  });

  // Convert to NormalizedCategoryApp with positions
  const apps: NormalizedCategoryApp[] = filteredApps.map((app, i) => ({
    slug: app.urlSlug ? `${app.id}--${app.urlSlug}` : app.id,
    name: app.name,
    shortDescription: app.shortDescription,
    averageRating: 0,
    ratingCount: 0,
    logoUrl: app.iconUrl || "",
    position: organicOffset + i + 1,
    isSponsored: false,
    badges: app.appType === "EXTENSION" ? ["canva_extension"] : [],
  }));

  const title = CANVA_SUBCATEGORY_LABELS[topicSlug] || topicSlug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    slug: categorySlug,
    url: `https://www.canva.com/apps?category=${categorySlug}`,
    title,
    description: "",
    appCount: filteredApps.length,
    apps,
    subcategoryLinks: [],
    hasNextPage: false,   // All apps are on a single page
  };
}
