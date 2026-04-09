/**
 * Platform badge for email templates.
 * Renders a small colored label showing which platform an app belongs to.
 */

const PLATFORM_COLORS: Record<string, string> = {
  shopify: "#95BF47",
  salesforce: "#00A1E0",
  canva: "#00C4CC",
  wix: "#0C6EFC",
  wordpress: "#21759B",
  "google-workspace": "#4285F4",
  atlassian: "#0052CC",
  zoom: "#2D8CFF",
  zoho: "#C8202B",
  zendesk: "#03363D",
  hubspot: "#FF7A59",
  woocommerce: "#7F54B3",
};

const PLATFORM_LABELS: Record<string, string> = {
  shopify: "Shopify",
  salesforce: "Salesforce",
  canva: "Canva",
  wix: "Wix",
  wordpress: "WordPress",
  "google-workspace": "Google Workspace",
  atlassian: "Atlassian",
  zoom: "Zoom",
  zoho: "Zoho",
  zendesk: "Zendesk",
  hubspot: "HubSpot",
  woocommerce: "WooCommerce",
};

/** Get human-readable platform label */
export function platformLabel(platform: string): string {
  if (!platform) return "Unknown";
  // Normalize: platform IDs may use underscores (google_workspace) or hyphens (google-workspace)
  const normalized = platform.replace(/_/g, "-");
  return PLATFORM_LABELS[normalized] || platform.replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/** Render a small colored platform badge for inline use in emails */
export function platformBadge(platform: string): string {
  const normalized = platform ? platform.replace(/_/g, "-") : "";
  const color = PLATFORM_COLORS[normalized] || "#6b7280";
  const label = platformLabel(platform);
  return `<span style="display:inline-block;background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;letter-spacing:0.5px;vertical-align:middle;">${label}</span>`;
}

/** Get platform prefix for email subjects, e.g. "[Shopify]" */
export function platformSubjectPrefix(platform: string): string {
  return `[${platformLabel(platform)}]`;
}
