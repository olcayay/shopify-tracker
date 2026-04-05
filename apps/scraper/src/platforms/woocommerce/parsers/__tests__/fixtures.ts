/**
 * JSON fixture helpers for WooCommerce parser tests.
 *
 * WooCommerce uses a REST API at /wp-json/wccom-extensions/1.0/.
 * These helpers produce realistic JSON matching the API response formats.
 */

import type { WooCommerceProduct } from "../app-parser.js";

// ---------------------------------------------------------------------------
// Product fixtures
// ---------------------------------------------------------------------------

interface ProductOverrides {
  title?: string;
  slug?: string;
  id?: number;
  excerpt?: string;
  icon?: string;
  image?: string;
  raw_price?: number;
  currency?: string;
  rating?: number | null;
  reviews_count?: number | null;
  vendor_name?: string;
  vendor_url?: string;
  type?: string;
  freemium_type?: string;
  is_on_sale?: boolean;
  regular_price?: number;
  hash?: string;
  is_installable?: boolean;
  billing_period?: string;
}

export function makeProduct(overrides: ProductOverrides = {}): WooCommerceProduct {
  return {
    title: overrides.title ?? "Test Extension",
    slug: overrides.slug ?? "test-extension",
    id: overrides.id ?? 12345,
    excerpt: overrides.excerpt ?? "A test WooCommerce extension.",
    icon: overrides.icon ?? "https://woocommerce.com/wp-content/uploads/icon.png",
    image: overrides.image ?? "",
    raw_price: overrides.raw_price ?? 79,
    currency: overrides.currency ?? "USD",
    rating: "rating" in overrides ? overrides.rating : 4.5,
    reviews_count: "reviews_count" in overrides ? overrides.reviews_count : 42,
    vendor_name: overrides.vendor_name ?? "Test Vendor",
    vendor_url: overrides.vendor_url ?? "https://woocommerce.com/vendor/test-vendor/",
    type: overrides.type ?? "extension",
    freemium_type: overrides.freemium_type ?? "unset",
    is_on_sale: overrides.is_on_sale ?? false,
    regular_price: overrides.regular_price ?? 79,
    hash: overrides.hash ?? "abc123def456",
    is_installable: overrides.is_installable ?? false,
    billing_period: overrides.billing_period ?? "",
    price: overrides.raw_price === 0 ? "$0" : `$${overrides.raw_price ?? 79}`,
  };
}

// ---------------------------------------------------------------------------
// Search API response fixtures
// ---------------------------------------------------------------------------

export function makeSearchResponse(
  products: WooCommerceProduct[] = [makeProduct()],
  totalProducts?: number,
  totalPages?: number,
): string {
  return JSON.stringify({
    products,
    total_products: totalProducts ?? products.length,
    total_pages: totalPages ?? 1,
  });
}

export function makeEmptySearchResponse(): string {
  return JSON.stringify({
    products: [],
    total_products: 0,
    total_pages: 0,
  });
}

// ---------------------------------------------------------------------------
// Featured response fixtures
// ---------------------------------------------------------------------------

export function makeFeaturedResponse(sectionCount = 2): string {
  const sections = Array.from({ length: sectionCount }, (_, i) => ({
    title: `Featured Section ${i + 1}`,
    module: `module-${i + 1}`,
    products: [
      makeProduct({ slug: `featured-app-${i}-1`, title: `Featured App ${i + 1}.1` }),
      makeProduct({ slug: `featured-app-${i}-2`, title: `Featured App ${i + 1}.2` }),
    ],
  }));
  return JSON.stringify({ sections });
}

export function makeEmptyFeaturedResponse(): string {
  return JSON.stringify({ sections: [] });
}
