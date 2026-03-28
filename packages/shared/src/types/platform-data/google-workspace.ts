/** Platform-specific data for Google Workspace Marketplace apps. */
export interface GoogleWorkspacePlatformData {
  googleWorkspaceAppId?: string;
  shortDescription?: string;
  detailedDescription?: string;
  category?: string;
  pricingModel?: "free" | "freemium" | "paid" | "free_trial" | "unknown";
  screenshots?: string[];
  worksWithApps?: string[];
  termsOfServiceUrl?: string;
  privacyPolicyUrl?: string;
  supportUrl?: string;
  casaCertified?: boolean;
  installCount?: number | null;
  developerWebsite?: string | null;
  listingUpdated?: string | null;
}
