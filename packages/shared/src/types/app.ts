/** Developer info from an app detail page */
export interface AppDeveloper {
  name: string;
  url: string;
  website?: string;
}

/** A feature within a subcategory on the app detail page */
export interface AppFeature {
  title: string;
  url: string;
  feature_handle: string;
}

/** A subcategory group within a category on the app detail page */
export interface AppSubcategoryGroup {
  title: string;
  features: AppFeature[];
}

/** A category listing from the app detail page */
export interface AppCategory {
  type?: "primary" | "secondary";
  title: string;
  url: string;
  subcategories: AppSubcategoryGroup[];
}

/** A pricing plan from the app detail page */
export interface PricingPlan {
  name: string;
  price: string | null;
  period: string | null;
  yearly_price: string | null;
  discount_text: string | null;
  trial_text: string | null;
  features: string[];
}

/** Support contact info from the app detail page */
export interface AppSupport {
  email: string | null;
  portal_url: string | null;
  phone: string | null;
}

/** Full app details scraped from a single app page */
export interface AppDetails {
  app_slug: string;
  app_name: string;
  icon_url: string | null;
  app_introduction: string;
  app_details: string;
  seo_title: string;
  seo_meta_description: string;
  features: string[];
  pricing: string;
  average_rating: number | null;
  rating_count: number | null;
  developer: AppDeveloper;
  launched_date: Date | null;
  demo_store_url: string | null;
  languages: string[];
  integrations: string[];
  categories: AppCategory[];
  pricing_plans: PricingPlan[];
  support: AppSupport | null;
}
