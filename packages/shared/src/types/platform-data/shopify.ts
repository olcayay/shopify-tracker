/** Platform-specific data for Shopify apps. */
export interface ShopifyPlatformData {
  /** App introduction text */
  appIntroduction?: string;
  /** Detailed app description */
  appDetails?: string;
  /** SEO title tag */
  seoTitle?: string;
  /** SEO meta description */
  seoMetaDescription?: string;
  /** Supported languages */
  languages?: string[];
  /** Demo store URL */
  demoStoreUrl?: string;
  /** Similar apps */
  similarApps?: { slug: string; name: string }[];
}
