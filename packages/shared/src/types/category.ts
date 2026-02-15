/** App card as shown in category/search listings (up to 24 per page) */
export interface FirstPageApp {
  name: string;
  short_description: string;
  average_rating: number;
  rating_count: number;
  app_url: string;
  logo_url: string;
  is_sponsored?: boolean;
  is_built_for_shopify?: boolean;
}

/** Metrics computed from the first 24 app cards on a category page */
export interface FirstPageMetrics {
  sponsored_count: number;
  built_for_shopify_count: number;
  count_100_plus_reviews: number;
  count_1000_plus_reviews: number;
  total_reviews: number;
  top_4_avg_rating: number;
  top_4_avg_rating_count: number;
  top_1_pct_reviews: number;
  top_4_pct_reviews: number;
  top_8_pct_reviews: number;
}

/** A node in the category tree (recursive) */
export interface CategoryNode {
  slug: string;
  url: string;
  data_source_url: string;
  title: string;
  breadcrumb: string;
  description: string;
  app_count: number | null;
  first_page_metrics: FirstPageMetrics | null;
  first_page_apps: FirstPageApp[];
  parent_slug: string | null;
  category_level: number;
  children: CategoryNode[];
}

/** Parsed data from a single category page */
export interface CategoryPageData {
  slug: string;
  url: string;
  data_source_url: string;
  title: string;
  breadcrumb: string;
  description: string;
  app_count: number | null;
  first_page_metrics: FirstPageMetrics | null;
  first_page_apps: FirstPageApp[];
  subcategory_links: { slug: string; url: string; title: string }[];
}
