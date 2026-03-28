/** Platform-specific data for Zoho Marketplace apps. */
export interface ZohoPlatformData {
  extensionId?: string;
  namespace?: string;
  tagline?: string;
  about?: string;
  pricing?: string;
  publishedDate?: string;
  version?: string;
  deploymentType?: string;
  cEdition?: unknown;
  categories?: { slug: string }[];
  partnerDetails?: {
    companyName?: string;
    supportEmail?: string;
    partner_uuid?: string;
    websiteUrl?: string;
  }[];
  versionhistory?: unknown;
  ratingBreakdown?: {
    onestar?: number;
    twostar?: number;
    threestar?: number;
    fourstar?: number;
    fivestar?: number;
  };
}
