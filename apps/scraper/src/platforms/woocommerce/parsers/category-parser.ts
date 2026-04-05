import type { NormalizedCategoryPage, NormalizedCategoryApp } from "../../platform-module.js";
import type { WooCommerceProduct } from "./app-parser.js";

interface WooCommerceSearchResponse {
  products?: WooCommerceProduct[];
  total_products?: number;
  total_pages?: number;
}

function buildPricingHint(product: WooCommerceProduct): string | undefined {
  if (product.raw_price === undefined || product.raw_price === null) return undefined;
  if (product.raw_price === 0) return "Free";
  const symbol = (product.currency || "USD") === "USD" ? "$" : product.currency || "";
  const period = product.billing_period ? `/${product.billing_period}` : "/year";
  return `${symbol}${product.raw_price}${period}`;
}

/** Parse a WooCommerce search API response as a category page. */
export function parseWooCommerceCategoryPage(
  json: string,
  categorySlug: string,
  url: string,
  page = 1,
): NormalizedCategoryPage {
  const data: WooCommerceSearchResponse = JSON.parse(json);
  const products = data.products ?? [];
  const totalProducts = data.total_products ?? 0;
  const totalPages = data.total_pages ?? 1;

  const apps: NormalizedCategoryApp[] = products.map((product, idx) => ({
    slug: product.slug || "",
    name: product.title || "",
    shortDescription: product.excerpt || "",
    averageRating: typeof product.rating === "number" ? product.rating : 0,
    ratingCount: typeof product.reviews_count === "number" ? product.reviews_count : 0,
    logoUrl: product.icon || product.image || "",
    pricingHint: buildPricingHint(product),
    position: (page - 1) * 60 + idx + 1,
    isSponsored: false,
    badges: [],
    extra: {
      vendorName: product.vendor_name || null,
      hash: product.hash || null,
      isOnSale: product.is_on_sale || false,
    },
  }));

  return {
    slug: categorySlug,
    url,
    title: categorySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    description: "",
    appCount: totalProducts,
    apps,
    subcategoryLinks: [], // Flat categories
    hasNextPage: page < totalPages,
  };
}
