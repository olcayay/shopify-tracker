import { createLogger } from "@appranks/shared";
import type { NormalizedCategoryPage, NormalizedCategoryApp } from "../../platform-module.js";
import { extractCanvaApps, type CanvaEmbeddedApp } from "./app-parser.js";
import { CANVA_FILTER_LABELS } from "../constants.js";

const log = createLogger("canva-category-parser");

/**
 * Mapping from our category slugs to the marketplace_topic.* tags
 * that belong to each filter category.
 */
const CATEGORY_TOPIC_MAP: Record<string, string[]> = {
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
 * Parse the Canva /apps page HTML to extract apps for a specific category.
 *
 * Since Canva embeds all apps in the main page, we filter by topic tags
 * matching the category slug.
 */
export function parseCanvaCategoryPage(
  html: string,
  categorySlug: string,
  page: number,
  organicOffset: number
): NormalizedCategoryPage {
  const allApps = extractCanvaApps(html);

  // Filter apps by topic tags matching this category
  const topicFilters = CATEGORY_TOPIC_MAP[categorySlug];
  let filteredApps: CanvaEmbeddedApp[];

  if (topicFilters) {
    filteredApps = allApps.filter((app) =>
      app.topics.some((t) => topicFilters.includes(t))
    );
  } else {
    // Unknown category — try matching by slug prefix
    const topicSlug = `marketplace_topic.${categorySlug.replace(/-/g, "_")}`;
    filteredApps = allApps.filter((app) =>
      app.topics.some((t) => t === topicSlug)
    );
  }

  log.info("filtered canva apps for category", {
    categorySlug,
    total: allApps.length,
    matched: filteredApps.length,
  });

  // Convert to NormalizedCategoryApp with positions
  const apps: NormalizedCategoryApp[] = filteredApps.map((app, i) => ({
    slug: app.urlSlug ? `${app.id}/${app.urlSlug}` : app.id,
    name: app.name,
    shortDescription: app.shortDescription,
    averageRating: 0,
    ratingCount: 0,
    logoUrl: app.iconUrl || "",
    position: organicOffset + i + 1,
    isSponsored: false,
    badges: [],
  }));

  const title = CANVA_FILTER_LABELS[categorySlug] || categorySlug
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
    subcategoryLinks: [], // Flat structure
    hasNextPage: false,   // All apps are on a single page
  };
}
