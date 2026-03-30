import { PLATFORM_IDS, type PlatformId } from "@appranks/shared";

export interface PlatformDisplayInfo {
  label: string;
  shortLabel: string;
  color: string;
  gradient: string;
  borderTop: string;
  textAccent: string;
}

export const PLATFORM_DISPLAY: Record<PlatformId, PlatformDisplayInfo> = {
  shopify: {
    label: "Shopify",
    shortLabel: "Shopify",
    color: "#95BF47",
    gradient: "from-[#95BF47]/10 to-transparent dark:from-[#95BF47]/20 dark:to-transparent",
    borderTop: "border-t-[#95BF47]",
    textAccent: "text-[#5E8E3E] dark:text-[#A8D35A]",
  },
  salesforce: {
    label: "Salesforce",
    shortLabel: "Salesforce",
    color: "#00A1E0",
    gradient: "from-[#00A1E0]/10 to-transparent dark:from-[#00A1E0]/20 dark:to-transparent",
    borderTop: "border-t-[#00A1E0]",
    textAccent: "text-[#0B5CAB] dark:text-[#4DB8E8]",
  },
  canva: {
    label: "Canva",
    shortLabel: "Canva",
    color: "#00C4CC",
    gradient: "from-[#00C4CC]/10 to-transparent dark:from-[#00C4CC]/20 dark:to-transparent",
    borderTop: "border-t-[#00C4CC]",
    textAccent: "text-[#00848A] dark:text-[#40D4DA]",
  },
  wix: {
    label: "Wix",
    shortLabel: "Wix",
    color: "#0C6EFC",
    gradient: "from-[#0C6EFC]/10 to-transparent dark:from-[#0C6EFC]/20 dark:to-transparent",
    borderTop: "border-t-[#0C6EFC]",
    textAccent: "text-[#0C6EFC] dark:text-[#5A9AFD]",
  },
  wordpress: {
    label: "WordPress",
    shortLabel: "WordPress",
    color: "#21759B",
    gradient: "from-[#21759B]/10 to-transparent dark:from-[#21759B]/20 dark:to-transparent",
    borderTop: "border-t-[#21759B]",
    textAccent: "text-[#21759B] dark:text-[#4BA3C7]",
  },
  google_workspace: {
    label: "Google Workspace",
    shortLabel: "Google WS",
    color: "#4285F4",
    gradient: "from-[#4285F4]/10 to-transparent dark:from-[#4285F4]/20 dark:to-transparent",
    borderTop: "border-t-[#4285F4]",
    textAccent: "text-[#4285F4] dark:text-[#7AABF7]",
  },
  atlassian: {
    label: "Atlassian",
    shortLabel: "Atlassian",
    color: "#0052CC",
    gradient: "from-[#0052CC]/10 to-transparent dark:from-[#0052CC]/20 dark:to-transparent",
    borderTop: "border-t-[#0052CC]",
    textAccent: "text-[#0052CC] dark:text-[#4D8FE0]",
  },
  zoom: {
    label: "Zoom",
    shortLabel: "Zoom",
    color: "#0B5CFF",
    gradient: "from-[#0B5CFF]/10 to-transparent dark:from-[#0B5CFF]/20 dark:to-transparent",
    borderTop: "border-t-[#0B5CFF]",
    textAccent: "text-[#0B5CFF] dark:text-[#5A8FFF]",
  },
  zoho: {
    label: "Zoho",
    shortLabel: "Zoho",
    color: "#D4382C",
    gradient: "from-[#D4382C]/10 to-transparent dark:from-[#D4382C]/20 dark:to-transparent",
    borderTop: "border-t-[#D4382C]",
    textAccent: "text-[#D4382C] dark:text-[#E5685E]",
  },
  zendesk: {
    label: "Zendesk",
    shortLabel: "Zendesk",
    color: "#03363D",
    gradient: "from-[#03363D]/10 to-transparent dark:from-[#03363D]/25 dark:to-transparent",
    borderTop: "border-t-[#03363D]",
    textAccent: "text-[#03363D] dark:text-[#5A9BA5]",
  },
  hubspot: {
    label: "HubSpot",
    shortLabel: "HubSpot",
    color: "#FF7A59",
    gradient: "from-[#FF7A59]/10 to-transparent dark:from-[#FF7A59]/20 dark:to-transparent",
    borderTop: "border-t-[#FF7A59]",
    textAccent: "text-[#FF7A59] dark:text-[#FFA088]",
  },
};

// Convenience accessors derived from PLATFORM_DISPLAY
export const PLATFORM_LABELS: Record<PlatformId, string> = Object.fromEntries(
  PLATFORM_IDS.map((id) => [id, PLATFORM_DISPLAY[id].label])
) as Record<PlatformId, string>;

export const PLATFORM_SHORT_LABELS: Record<PlatformId, string> = Object.fromEntries(
  PLATFORM_IDS.map((id) => [id, PLATFORM_DISPLAY[id].shortLabel])
) as Record<PlatformId, string>;

export const PLATFORM_COLORS: Record<PlatformId, string> = Object.fromEntries(
  PLATFORM_IDS.map((id) => [id, PLATFORM_DISPLAY[id].color])
) as Record<PlatformId, string>;

// String-safe accessors for when platform comes from API as plain string
export function getPlatformLabel(platform: string): string {
  return PLATFORM_LABELS[platform as PlatformId] || platform;
}

export function getPlatformColor(platform: string): string {
  return PLATFORM_COLORS[platform as PlatformId] || "#888";
}

export function getPlatformDisplay(platform: string): PlatformDisplayInfo | undefined {
  return PLATFORM_DISPLAY[platform as PlatformId];
}

export const SCRAPER_TYPE_LABELS: Record<string, string> = {
  category: "Categories",
  app_details: "App Details",
  keyword_search: "Keywords",
  reviews: "Reviews",
  compute_app_scores: "Scores",
};

export const HEALTH_SCRAPER_TYPES = ["category", "app_details", "keyword_search", "reviews", "compute_app_scores"] as const;
