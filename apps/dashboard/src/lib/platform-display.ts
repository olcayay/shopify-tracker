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
    gradient: "from-[#95BF47]/10 to-transparent",
    borderTop: "border-t-[#95BF47]",
    textAccent: "text-[#5E8E3E]",
  },
  salesforce: {
    label: "Salesforce",
    shortLabel: "Salesforce",
    color: "#00A1E0",
    gradient: "from-[#00A1E0]/10 to-transparent",
    borderTop: "border-t-[#00A1E0]",
    textAccent: "text-[#0B5CAB]",
  },
  canva: {
    label: "Canva",
    shortLabel: "Canva",
    color: "#00C4CC",
    gradient: "from-[#00C4CC]/10 to-transparent",
    borderTop: "border-t-[#00C4CC]",
    textAccent: "text-[#00848A]",
  },
  wix: {
    label: "Wix",
    shortLabel: "Wix",
    color: "#0C6EFC",
    gradient: "from-[#0C6EFC]/10 to-transparent",
    borderTop: "border-t-[#0C6EFC]",
    textAccent: "text-[#0C6EFC]",
  },
  wordpress: {
    label: "WordPress",
    shortLabel: "WordPress",
    color: "#21759B",
    gradient: "from-[#21759B]/10 to-transparent",
    borderTop: "border-t-[#21759B]",
    textAccent: "text-[#21759B]",
  },
  google_workspace: {
    label: "Google Workspace",
    shortLabel: "Google WS",
    color: "#4285F4",
    gradient: "from-[#4285F4]/10 to-transparent",
    borderTop: "border-t-[#4285F4]",
    textAccent: "text-[#4285F4]",
  },
  atlassian: {
    label: "Atlassian",
    shortLabel: "Atlassian",
    color: "#0052CC",
    gradient: "from-[#0052CC]/10 to-transparent",
    borderTop: "border-t-[#0052CC]",
    textAccent: "text-[#0052CC]",
  },
  zoom: {
    label: "Zoom",
    shortLabel: "Zoom",
    color: "#0B5CFF",
    gradient: "from-[#0B5CFF]/10 to-transparent",
    borderTop: "border-t-[#0B5CFF]",
    textAccent: "text-[#0B5CFF]",
  },
  zoho: {
    label: "Zoho",
    shortLabel: "Zoho",
    color: "#D4382C",
    gradient: "from-[#D4382C]/10 to-transparent",
    borderTop: "border-t-[#D4382C]",
    textAccent: "text-[#D4382C]",
  },
  zendesk: {
    label: "Zendesk",
    shortLabel: "Zendesk",
    color: "#03363D",
    gradient: "from-[#03363D]/10 to-transparent",
    borderTop: "border-t-[#03363D]",
    textAccent: "text-[#03363D]",
  },
  hubspot: {
    label: "HubSpot",
    shortLabel: "HubSpot",
    color: "#FF7A59",
    gradient: "from-[#FF7A59]/10 to-transparent",
    borderTop: "border-t-[#FF7A59]",
    textAccent: "text-[#FF7A59]",
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
