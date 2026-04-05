/** Platform-specific data for WooCommerce Marketplace extensions. */
export interface WooCommercePlatformData {
  shortDescription?: string;
  pricing?: string;
  rawPrice?: number;
  currency?: string;
  billingPeriod?: string;
  regularPrice?: number;
  isOnSale?: boolean;
  freemiumType?: string;
  vendorName?: string;
  vendorUrl?: string;
  type?: string;
  hash?: string;
  isInstallable?: boolean;
  categories?: { slug: string; label: string }[];
  source?: string;
}
