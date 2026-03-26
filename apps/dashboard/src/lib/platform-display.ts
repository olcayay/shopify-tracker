import type { PlatformId } from "@appranks/shared";

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  shopify: "Shopify",
  salesforce: "Salesforce",
  canva: "Canva",
  wix: "Wix",
  wordpress: "WordPress",
  google_workspace: "Google WS",
  atlassian: "Atlassian",
  zoom: "Zoom",
  zoho: "Zoho",
  zendesk: "Zendesk",
  hubspot: "HubSpot",
};

export const PLATFORM_COLORS: Record<PlatformId, string> = {
  shopify: "#95BF47",
  salesforce: "#00A1E0",
  canva: "#00C4CC",
  wix: "#0C6EFC",
  wordpress: "#21759B",
  google_workspace: "#4285F4",
  atlassian: "#0052CC",
  zoom: "#0B5CFF",
  zoho: "#D4382C",
  zendesk: "#03363D",
  hubspot: "#FF7A59",
};

export const SCRAPER_TYPE_LABELS: Record<string, string> = {
  category: "Categories",
  app_details: "App Details",
  keyword_search: "Keywords",
  reviews: "Reviews",
  compute_app_scores: "Scores",
};

export const HEALTH_SCRAPER_TYPES = ["category", "app_details", "keyword_search", "reviews", "compute_app_scores"] as const;
