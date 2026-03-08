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
  "social-networking": "Social Networking",
  "email": "Email",
  "display": "Display",
  // File and data management
  "file-import-and-export": "File Import and Export",
  "file-converters": "File Converters",
  "data-connectors": "Data Connectors",
  "data-visualization": "Data Visualization",
  // Graphic design
  "icons-and-illustrations": "Icons and Illustrations",
  "shapes": "Shapes",
  "frames": "Frames",
  "patterns": "Patterns",
  "mockups": "Mockups",
  "logos": "Logos",
  // Marketing
  "content-schedulers": "Content Schedulers",
  "analytics": "Analytics",
  "ads": "Ads",
  // Photo editing
  "photo-effects": "Photo Effects",
  "images": "Images",
  "styles": "Styles",
  "color": "Color",
  // Project management
  "tasks-and-workflows": "Tasks and Workflows",
  "documents": "Documents",
  "forms": "Forms",
  "interactivity": "Interactivity",
  // Text styling
  "text-effects": "Text Effects",
  "text-generators": "Text Generators",
  // Video and animation
  "videos": "Videos",
  "video-effects": "Video Effects",
  "animation": "Animation",
  "subtitles": "Subtitles",
  "flipbooks": "Flipbooks",
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
