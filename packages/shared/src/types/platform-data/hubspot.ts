/** Platform-specific data for HubSpot App Marketplace apps. */
export interface HubSpotPlatformData {
  shortDescription?: string;
  longDescription?: string;
  pricing?: string;
  pricingPlans?: {
    name: string;
    model?: string;
    monthlyPrice?: number;
    features?: string[];
  }[];
  categories?: { slug: string; name: string }[];
  installCount?: number;
  launchedDate?: string;
  offeringId?: number;
  productType?: string;
  connectionType?: string;
  certified?: boolean;
  builtByHubSpot?: boolean;
  source?: "chirp-api";
}
