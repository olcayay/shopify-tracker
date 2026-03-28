/** Platform-specific data for Wix App Market apps. */
export interface WixPlatformData {
  tagline?: string;
  description?: string;
  benefits?: string[];
  demoUrl?: string;
  categories?: { slug: string; title: string; parentSlug?: string; parentTitle?: string; url?: string }[];
  collections?: { slug: string; name: string }[];
  screenshots?: string[];
  pricingPlans?: {
    name: string;
    isFree: boolean;
    monthlyPrice?: number;
    yearlyPrice?: number;
    oneTimePrice?: number;
    type?: string;
    benefits?: string[];
  }[];
  currency?: string;
  isFreeApp?: boolean;
  trialDays?: number;
  languages?: string[];
  isAvailableWorldwide?: boolean;
  ratingHistogram?: {
    rating5?: number;
    rating4?: number;
    rating3?: number;
    rating2?: number;
    rating1?: number;
  };
  promotionalImage?: string;
  developerEmail?: string;
  developerPrivacyUrl?: string;
}
