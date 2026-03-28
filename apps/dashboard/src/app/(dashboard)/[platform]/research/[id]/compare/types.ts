export interface AppData {
  slug: string;
  name: string;
  iconUrl: string | null;
  appCardSubtitle: string | null;
  /** Emoji icon for virtual apps */
  icon?: string;
  /** Hex color for virtual apps */
  color?: string;
  latestSnapshot: {
    appIntroduction: string;
    appDetails: string;
    features: string[];
    languages: string[];
    integrations: string[];
    pricingPlans: any[];
    categories: any[];
    seoTitle: string;
    seoMetaDescription: string;
    averageRating: string | null;
    ratingCount: number | null;
  } | null;
}
