/** Platform-specific data for Atlassian Marketplace apps. */
export interface AtlassianPlatformData {
  appId?: number;
  tagLine?: string;
  summary?: string;
  description?: string;
  hostingVisibility?: string;
  totalInstalls?: number;
  downloads?: number;
  categories?: { slug: string; name: string }[];
  cloudFortified?: boolean;
  topVendor?: boolean;
  vendorName?: string;
  lastModified?: string;
  vendorLinks?: Record<string, string>;
  vendorId?: string;
  bugBountyParticipant?: boolean;
  tagCategories?: string[];
  tagKeywords?: string[];
  listingCategories?: string[];
  version?: string;
  paymentModel?: string;
  releaseDate?: string;
  licenseType?: string;
  compatibilities?: {
    application?: string;
    cloud?: boolean;
    server?: boolean;
    dataCenter?: boolean;
  }[];
  highlights?: { title: string; body: string }[];
  fullDescription?: string;
  documentationUrl?: string;
  eulaUrl?: string;
  supportEmail?: string;
  supportUrl?: string;
  supportPhone?: string;
  contactEmail?: string;
  vendorAddress?: string;
  vendorHomePage?: string;
  slaUrl?: string;
  trustCenterUrl?: string;
}
