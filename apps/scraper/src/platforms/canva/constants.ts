import type { PlatformConstants, PlatformScoringConfig } from "../platform-module.js";

/**
 * Canva marketplace_topic.* slugs that map to the 10 top-level filter categories
 * on the /apps page. These are used as seed categories for scraping.
 *
 * The mapping to UI categories (updated 2026-03-14):
 *   AI generation       → ai_images, ai_audio, ai_videos, ai_text, ai_documents
 *   Audio and voiceover → music, voiceovers, sound_effects
 *   Communication       → cards_and_invitations, content_schedulers, email, social_networking
 *   File and data mgmt  → analytics, data_connectors, data_visualization, file_converters, file_import_and_export
 *   Graphic design      → color, data_visualization, documents, flipbooks, frames, icons_and_illustrations, images, interactivity, logos, mockups, patterns, print_products, qr_and_barcodes, shapes, videos
 *   Marketing           → ads, content_schedulers, display, email, flipbooks, forms, logos, mockups, print_products, qr_and_barcodes, social_networking
 *   Photo editing       → photo_effects, images, styles
 *   Project management  → content_schedulers, forms, social_networking, tasks_and_workflows
 *   Text styling        → text_effects, text_generators, forms
 *   Video and animation → animation, avatars, subtitles, video_effects, videos
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

/**
 * Mapping from topic slug (used as sub-category slug) to its display label.
 * These are the actual ranking-level categories within each filter category.
 */
export const CANVA_SUBCATEGORY_LABELS: Record<string, string> = {
  // AI generation
  "ai-images": "AI Images",
  "ai-audio": "AI Audio",
  "ai-videos": "AI Videos",
  "ai-text": "AI Text",
  "ai-documents": "AI Documents",
  // Audio and voiceover
  "music": "Music",
  "voiceovers": "Voiceovers",
  "sound-effects": "Sound Effects",
  // Communication
  "cards-and-invitations": "Cards and Invitations",
  "content-schedulers": "Content Schedulers",
  "email": "Email",
  "social-networking": "Social Networking",
  // File and data management
  "analytics": "Analytics",
  "data-connectors": "Data Connectors",
  "data-visualization": "Data Visualization",
  "file-converters": "File Converters",
  "file-import-and-export": "File Import and Export",
  // Graphic design
  "color": "Color",
  "documents": "Documents",
  "flipbooks": "Flipbooks",
  "frames": "Frames",
  "icons-and-illustrations": "Icons and Illustrations",
  "images": "Images",
  "interactivity": "Interactivity",
  "logos": "Logos",
  "mockups": "Mockups",
  "patterns": "Patterns",
  "print-products": "Print Products",
  "qr-and-barcodes": "QR and Barcodes",
  "shapes": "Shapes",
  // Marketing
  "ads": "Ads",
  "display": "Display",
  // Photo editing
  "photo-effects": "Photo Effects",
  "styles": "Styles",
  // Project management
  "tasks-and-workflows": "Tasks and Workflows",
  "forms": "Forms",
  // Text styling
  "text-effects": "Text Effects",
  "text-generators": "Text Generators",
  // Video and animation
  "animation": "Animation",
  "avatars": "Avatars",
  "subtitles": "Subtitles",
  "video-effects": "Video Effects",
  "videos": "Videos",
};

export const CANVA_CONSTANTS: PlatformConstants = {
  seedCategories: [...CANVA_FILTER_CATEGORIES],
  maxCategoryDepth: 1, // Two-level: filter categories (hub) → topic sub-categories (listing)
  defaultPagesPerCategory: 1, // All apps are on a single page
  trackedFields: [
    "description",
    "tagline",
    "fullDescription",
    "developer",
    "topics",
    "screenshots",
    "permissions",
    "languages",
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
