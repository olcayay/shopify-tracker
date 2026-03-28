export interface AppData {
  slug: string;
  name: string;
  iconUrl: string | null;
  appCardSubtitle: string | null;
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
    platformData?: Record<string, any>;
  } | null;
}

export interface CategoryRanking {
  categorySlug: string;
  categoryTitle: string;
  position: number;
}
