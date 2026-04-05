import { z } from "zod";
import type { PlatformId } from "../../constants/platforms.js";

// --- Zod schemas for non-blocking validation of platformData ---

export const ShopifyPlatformDataSchema = z.object({
  appIntroduction: z.string().optional(),
  appDetails: z.string().optional(),
  seoTitle: z.string().optional(),
  seoMetaDescription: z.string().optional(),
  languages: z.array(z.string()).optional(),
  demoStoreUrl: z.string().optional(),
  similarApps: z.array(z.object({ slug: z.string(), name: z.string() })).optional(),
}).passthrough();

export const SalesforcePlatformDataSchema = z.object({
  description: z.string().optional(),
  fullDescription: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  publishedDate: z.string().nullable().optional(),
  languages: z.array(z.string()).optional(),
  productsSupported: z.array(z.string()).optional(),
  productsRequired: z.array(z.string()).optional(),
  pricingModelType: z.string().nullable().optional(),
  supportedIndustries: z.array(z.string()).optional(),
  targetUserPersona: z.array(z.string()).optional(),
  businessNeeds: z.array(z.string()).optional(),
}).passthrough();

export const CanvaPlatformDataSchema = z.object({
  canvaAppId: z.string().optional(),
  canvaAppType: z.string().optional(),
  description: z.string().optional(),
  tagline: z.string().optional(),
  fullDescription: z.string().optional(),
  topics: z.array(z.string()).optional(),
  urlSlug: z.string().optional(),
  screenshots: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  promoCardUrl: z.string().optional(),
  developerEmail: z.string().optional(),
  developerPhone: z.string().optional(),
  developerAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).nullable().optional(),
  termsUrl: z.string().optional(),
  privacyUrl: z.string().optional(),
  permissions: z.array(z.object({ scope: z.string(), type: z.string() })).optional(),
}).passthrough();

export const WixPlatformDataSchema = z.object({
  tagline: z.string().optional(),
  description: z.string().optional(),
  benefits: z.array(z.string()).optional(),
  demoUrl: z.string().optional(),
  isFreeApp: z.boolean().optional(),
  trialDays: z.number().optional(),
  languages: z.array(z.string()).optional(),
  isAvailableWorldwide: z.boolean().optional(),
}).passthrough();

export const WordPressPlatformDataSchema = z.object({
  shortDescription: z.string().optional(),
  version: z.string().optional(),
  testedUpTo: z.string().optional(),
  requiresWP: z.string().nullable().optional(),
  requiresPHP: z.string().nullable().optional(),
  activeInstalls: z.number().optional(),
  downloaded: z.number().nullable().optional(),
  lastUpdated: z.string().optional(),
  added: z.string().optional(),
  businessModel: z.string().nullable().optional(),
}).passthrough();

export const GoogleWorkspacePlatformDataSchema = z.object({
  googleWorkspaceAppId: z.string().optional(),
  shortDescription: z.string().optional(),
  detailedDescription: z.string().optional(),
  category: z.string().optional(),
  pricingModel: z.string().optional(),
  screenshots: z.array(z.string()).optional(),
  worksWithApps: z.array(z.string()).optional(),
  casaCertified: z.boolean().optional(),
  installCount: z.number().nullable().optional(),
}).passthrough();

export const AtlassianPlatformDataSchema = z.object({
  appId: z.number().optional(),
  tagLine: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  totalInstalls: z.number().optional(),
  cloudFortified: z.boolean().optional(),
  topVendor: z.boolean().optional(),
  bugBountyParticipant: z.boolean().optional(),
  version: z.string().optional(),
  paymentModel: z.string().optional(),
  releaseDate: z.string().optional(),
  licenseType: z.string().optional(),
}).passthrough();

export const ZoomPlatformDataSchema = z.object({
  description: z.string().optional(),
  companyName: z.string().optional(),
  worksWith: z.array(z.string()).optional(),
  usage: z.string().optional(),
  fedRampAuthorized: z.boolean().optional(),
  essentialApp: z.boolean().optional(),
}).passthrough();

export const ZohoPlatformDataSchema = z.object({
  extensionId: z.string().optional(),
  namespace: z.string().optional(),
  tagline: z.string().optional(),
  about: z.string().optional(),
  pricing: z.string().optional(),
  publishedDate: z.string().optional(),
  version: z.string().optional(),
  deploymentType: z.string().optional(),
}).passthrough();

export const ZendeskPlatformDataSchema = z.object({
  shortDescription: z.string().optional(),
  longDescription: z.string().optional(),
  installationInstructions: z.string().optional(),
  pricing: z.string().optional(),
  datePublished: z.string().optional(),
  version: z.string().optional(),
  products: z.array(z.string()).optional(),
  source: z.string().optional(),
}).passthrough();

export const HubSpotPlatformDataSchema = z.object({
  shortDescription: z.string().optional(),
  longDescription: z.string().optional(),
  pricing: z.string().optional(),
  installCount: z.number().optional(),
  launchedDate: z.string().optional(),
  offeringId: z.number().optional(),
  certified: z.boolean().optional(),
  builtByHubSpot: z.boolean().optional(),
  source: z.string().optional(),
}).passthrough();

export const WooCommercePlatformDataSchema = z.object({
  shortDescription: z.string().optional(),
  pricing: z.string().optional(),
  rawPrice: z.number().optional(),
  currency: z.string().optional(),
  billingPeriod: z.string().optional(),
  regularPrice: z.number().optional(),
  isOnSale: z.boolean().optional(),
  freemiumType: z.string().optional(),
  vendorName: z.string().optional(),
  vendorUrl: z.string().optional(),
  type: z.string().optional(),
  hash: z.string().optional(),
  isInstallable: z.boolean().optional(),
  categories: z.array(z.object({ slug: z.string(), label: z.string() })).optional(),
  source: z.string().optional(),
}).passthrough();

/** Schema registry keyed by platform ID. */
const PLATFORM_SCHEMAS: Partial<Record<PlatformId, z.ZodType>> = {
  shopify: ShopifyPlatformDataSchema,
  salesforce: SalesforcePlatformDataSchema,
  canva: CanvaPlatformDataSchema,
  wix: WixPlatformDataSchema,
  wordpress: WordPressPlatformDataSchema,
  google_workspace: GoogleWorkspacePlatformDataSchema,
  atlassian: AtlassianPlatformDataSchema,
  zoom: ZoomPlatformDataSchema,
  zoho: ZohoPlatformDataSchema,
  zendesk: ZendeskPlatformDataSchema,
  hubspot: HubSpotPlatformDataSchema,
  woocommerce: WooCommercePlatformDataSchema,
};

/** Validate platformData against the platform's schema. Non-blocking — returns result. */
export function validatePlatformData(
  platform: PlatformId,
  data: unknown
): { success: true; data: Record<string, unknown> } | { success: false; errors: z.ZodError } {
  const schema = PLATFORM_SCHEMAS[platform];
  if (!schema) return { success: true, data: (data ?? {}) as Record<string, unknown> };

  const result = schema.safeParse(data ?? {});
  if (result.success) return { success: true, data: result.data as Record<string, unknown> };
  return { success: false, errors: result.error };
}
