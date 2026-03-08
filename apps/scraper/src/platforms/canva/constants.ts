import type { PlatformConstants, PlatformScoringConfig } from "../platform-module.js";

/**
 * Canva marketplace_topic.* slugs that map to the 10 top-level filter categories
 * on the /apps page. These are used as seed categories for scraping.
 *
 * The mapping to UI categories:
 *   AI generation       → ai_images, ai_audio, ai_videos, ai_text, ai_documents
 *   Audio and voiceover → music, voiceovers, sound_effects
 *   Communication       → social_networking, email, ads, display
 *   File and data mgmt  → file_import_and_export, file_converters, data_connectors, data_visualization
 *   Graphic design      → icons_and_illustrations, shapes, frames, patterns, mockups, logos
 *   Marketing           → content_schedulers, analytics, ads, email
 *   Photo editing       → photo_effects, images, styles, color
 *   Project management  → tasks_and_workflows, documents, forms, interactivity
 *   Text styling        → text_effects, text_generators
 *   Video and animation → videos, video_effects, animation, subtitles, flipbooks
 */
export const CANVA_FILTER_CATEGORIES = [
  "ai-generation",
  "audio-and-voiceover",
  "communication",
  "file-and-data-management",
  "graphic-design",
  "marketing",
  "photo-editing",
  "project-management",
  "text-styling",
  "video-and-animation",
] as const;

/** Mapping from UI filter category to the exact button text on canva.com/apps */
export const CANVA_FILTER_LABELS: Record<string, string> = {
  "ai-generation": "AI generation",
  "audio-and-voiceover": "Audio and voiceover",
  "communication": "Communication",
  "file-and-data-management": "File and data management",
  "graphic-design": "Graphic design",
  "marketing": "Marketing",
  "photo-editing": "Photo editing",
  "project-management": "Project management",
  "text-styling": "Text styling",
  "video-and-animation": "Video and animation",
};

/** Featured sections visible on the /apps page */
export const CANVA_FEATURED_SECTIONS = [
  "Design with your favorite media",
  "Enhance your images",
  "Supercharge your workflow",
] as const;

export const CANVA_CONSTANTS: PlatformConstants = {
  seedCategories: [...CANVA_FILTER_CATEGORIES],
  maxCategoryDepth: 0, // Flat structure, no subcategories
  defaultPagesPerCategory: 1, // All apps are on a single page
  trackedFields: [
    "description",
    "tagline",
    "developer",
    "topics",
  ],
  rateLimit: { minDelayMs: 2000, maxDelayMs: 4000 }, // Conservative — Cloudflare protected
};

export const CANVA_SCORING: PlatformScoringConfig = {
  pageSize: 30,
  pageDecay: 0.85,
  similarityWeights: {
    category: 0.40, // Categories are a strong signal
    feature: 0.0,   // No feature taxonomy
    keyword: 0.20,  // Keyword search now supported
    text: 0.40,
  },
  stopWords: new Set([
    "canva", "app", "apps", "the", "and", "for",
    "with", "your", "this", "that", "from", "are", "all", "you",
    "can", "will", "has", "have", "not", "but", "they", "more",
    "their", "what", "when", "out", "also", "its", "our", "how",
    "get", "use", "new", "one", "just", "make", "any", "about",
    "design", "designs", "create", "add", "images", "image",
    "easily", "into", "text", "photos", "photo",
  ]),
};
