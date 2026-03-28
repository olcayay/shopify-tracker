/** Platform-specific data for Salesforce AppExchange apps. */
export interface SalesforcePlatformData {
  description?: string;
  fullDescription?: string;
  highlights?: string[];
  publishedDate?: string | null;
  languages?: string[];
  listingCategories?: { name: string; slug: string }[];
  productsSupported?: string[];
  productsRequired?: string[];
  pricingModelType?: string | null;
  publisher?: {
    name?: string;
    email?: string;
    website?: string;
    description?: string;
    employees?: string;
    yearFounded?: string;
    location?: string;
    country?: string;
  };
  technology?: unknown;
  editions?: unknown[];
  supportedIndustries?: string[];
  targetUserPersona?: string[];
  solution?: {
    manifest?: unknown;
    latestVersionDate?: string;
    packageId?: string;
    namespacePrefix?: string;
    packageCategory?: string;
    createdDate?: string;
    lastModifiedDate?: string;
  };
  businessNeeds?: string[];
  plugins?: {
    videos?: unknown[];
    resources?: unknown[];
    carousel?: unknown[];
    logos?: unknown[];
  };
}
