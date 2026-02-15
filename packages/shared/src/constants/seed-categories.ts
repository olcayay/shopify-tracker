/** The 6 root category slugs that seed the category tree crawl */
export const SEED_CATEGORY_SLUGS = [
  "finding-products",
  "selling-products",
  "orders-and-shipping",
  "store-design",
  "marketing-and-conversion",
  "store-management",
] as const;

export type SeedCategorySlug = (typeof SEED_CATEGORY_SLUGS)[number];

/** Maximum depth for category tree crawl (0 = root, up to 4) */
export const MAX_CATEGORY_DEPTH = 4;
