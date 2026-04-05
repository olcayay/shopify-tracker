import type { NormalizedSearchPage, NormalizedSearchApp } from "../../platform-module.js";
import type { WooCommerceProduct } from "./app-parser.js";

interface WooCommerceSearchResponse {
  products?: WooCommerceProduct[];
  total_products?: number;
  total_pages?: number;
}

/** Parse a WooCommerce search API response as a search results page. */
export function parseWooCommerceSearchPage(
  json: string,
  keyword: string,
  page: number,
): NormalizedSearchPage {
  const data: WooCommerceSearchResponse = JSON.parse(json);
  const products = data.products ?? [];
  const totalProducts = data.total_products ?? 0;
  const totalPages = data.total_pages ?? 1;

  const apps: NormalizedSearchApp[] = products.map((product, idx) => ({
    position: (page - 1) * 60 + idx + 1,
    appSlug: product.slug || "",
    appName: product.title || "",
    shortDescription: product.excerpt || "",
    averageRating: typeof product.rating === "number" ? product.rating : 0,
    ratingCount: typeof product.reviews_count === "number" ? product.reviews_count : 0,
    logoUrl: product.icon || product.image || "",
    isSponsored: false,
    badges: [],
  }));

  return {
    keyword,
    totalResults: totalProducts,
    apps,
    hasNextPage: page < totalPages,
    currentPage: page,
  };
}
