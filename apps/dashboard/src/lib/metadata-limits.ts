/**
 * Platform-specific metadata character limits.
 * Single source of truth — used by preview editors AND compare pages.
 */

export interface MetadataLimits {
  appName: number;
  subtitle: number;       // Shopify: "App Card Subtitle", Canva: "Tagline", Salesforce: N/A
  introduction: number;   // Shopify: "App Introduction", Canva: "Short Description", Salesforce: "Description"
  details: number;        // Shopify: "App Details", Canva: "Description", Salesforce: "Full Description"
  feature: number;        // per-feature limit
  seoTitle: number;
  seoMetaDescription: number;
}

const shopifyLimits: MetadataLimits = {
  appName: 30,
  subtitle: 62,
  introduction: 100,
  details: 500,
  feature: 80,
  seoTitle: 60,
  seoMetaDescription: 160,
};

const salesforceLimits: MetadataLimits = {
  appName: 80,
  subtitle: 62,
  introduction: 500,
  details: 2000,
  feature: 80,
  seoTitle: 60,
  seoMetaDescription: 160,
};

const canvaLimits: MetadataLimits = {
  appName: 18,
  subtitle: 50,       // Tagline
  introduction: 50,   // Short Description
  details: 200,       // Description
  feature: 80,
  seoTitle: 60,
  seoMetaDescription: 160,
};

const wixLimits: MetadataLimits = {
  appName: 50,
  subtitle: 80,       // Tagline
  introduction: 200,  // Short Description
  details: 2000,      // Description
  feature: 80,
  seoTitle: 60,
  seoMetaDescription: 160,
};

const wordpressLimits: MetadataLimits = {
  appName: 70,
  subtitle: 150,
  introduction: 150,
  details: 5000,
  feature: 0,
  seoTitle: 0,
  seoMetaDescription: 0,
};

const googleWorkspaceLimits: MetadataLimits = {
  appName: 50,
  subtitle: 200,
  introduction: 200,
  details: 16000,
  feature: 0,
  seoTitle: 0,
  seoMetaDescription: 0,
};

const atlassianLimits: MetadataLimits = {
  appName: 50,
  subtitle: 80,       // Tag Line
  introduction: 150,  // Summary
  details: 5000,      // Full Description
  feature: 0,
  seoTitle: 0,
  seoMetaDescription: 0,
};

const zoomLimits: MetadataLimits = {
  appName: 50,
  subtitle: 80,
  introduction: 200,
  details: 2000,
  feature: 0,
  seoTitle: 0,
  seoMetaDescription: 0,
};

const zohoLimits: MetadataLimits = {
  appName: 50,
  subtitle: 80,
  introduction: 200,
  details: 2000,
  feature: 0,
  seoTitle: 0,
  seoMetaDescription: 0,
};

const zendeskLimits: MetadataLimits = {
  appName: 50,
  subtitle: 80,
  introduction: 200,
  details: 5000,
  feature: 0,
  seoTitle: 0,
  seoMetaDescription: 0,
};

const defaultLimits = shopifyLimits;

const limitsByPlatform: Record<string, MetadataLimits> = {
  shopify: shopifyLimits,
  salesforce: salesforceLimits,
  canva: canvaLimits,
  wix: wixLimits,
  wordpress: wordpressLimits,
  google_workspace: googleWorkspaceLimits,
  atlassian: atlassianLimits,
  zoom: zoomLimits,
  zoho: zohoLimits,
  zendesk: zendeskLimits,
};

export function getMetadataLimits(platform: string): MetadataLimits {
  return limitsByPlatform[platform] ?? defaultLimits;
}
