/** A single app result from a keyword search */
export interface KeywordSearchApp {
  position: number;
  app_slug: string;
  app_name: string;
  short_description: string;
  average_rating: number;
  rating_count: number;
  app_url: string;
  logo_url: string;
  pricing_hint?: string;
  is_sponsored?: boolean;
  is_built_in?: boolean;
  is_built_for_shopify?: boolean;
}

/** Parsed data from a keyword search page */
export interface SearchPageData {
  keyword: string;
  total_results: number | null;
  apps: KeywordSearchApp[];
  has_next_page: boolean;
  current_page: number;
}
