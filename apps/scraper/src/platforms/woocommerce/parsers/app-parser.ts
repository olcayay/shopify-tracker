import type { NormalizedAppDetails } from "../../platform-module.js";
import type { WooCommercePlatformData } from "@appranks/shared";

/** Raw product shape from WooCommerce search API. */
export interface WooCommerceProduct {
  title?: string;
  slug?: string;
  id?: number;
  excerpt?: string;
  link?: string;
  image?: string;
  icon?: string;
  price?: string;
  raw_price?: number;
  currency?: string;
  hash?: string;
  type?: string;
  freemium_type?: string;
  is_on_sale?: boolean;
  regular_price?: number;
  rating?: number | null;
  reviews_count?: number | null;
  vendor_name?: string;
  vendor_url?: string;
  is_installable?: boolean;
  billing_period?: string;
  billing_period_interval?: string;
  label?: string | null;
  primary_color?: string | null;
  text_color?: string | null;
  button?: string | null;
}

function buildPricingHint(product: WooCommerceProduct): string | null {
  if (product.raw_price === undefined || product.raw_price === null) return null;
  if (product.raw_price === 0) return "Free";
  const currency = product.currency || "USD";
  const symbol = currency === "USD" ? "$" : currency;
  const period = product.billing_period ? `/${product.billing_period}` : "/year";
  return `${symbol}${product.raw_price}${period}`;
}

function buildBadges(product: WooCommerceProduct): string[] {
  const badges: string[] = [];
  if (product.vendor_name?.toLowerCase() === "woo" || product.vendor_name?.toLowerCase() === "woocommerce") {
    badges.push("developed_by_woo");
  }
  if (product.is_on_sale) {
    badges.push("on_sale");
  }
  if (product.freemium_type === "freemium") {
    badges.push("freemium");
  }
  return badges;
}

/** Parse a single product from the WooCommerce search API response. */
export function parseWooCommerceAppDetails(json: string, slug: string): NormalizedAppDetails {
  const data = JSON.parse(json);

  // Support both single product and search response with products array
  let product: WooCommerceProduct;
  if (data.products && Array.isArray(data.products)) {
    // Find the product matching the slug
    product = data.products.find((p: WooCommerceProduct) => p.slug === slug) ?? data.products[0] ?? {};
  } else {
    product = data;
  }

  const name = product.title || slug;
  const iconUrl = product.icon || product.image || null;
  const pricingHint = buildPricingHint(product);

  const platformData: WooCommercePlatformData = {
    shortDescription: product.excerpt || undefined,
    pricing: pricingHint || undefined,
    rawPrice: product.raw_price,
    currency: product.currency || undefined,
    billingPeriod: product.billing_period || undefined,
    regularPrice: product.regular_price,
    isOnSale: product.is_on_sale,
    freemiumType: product.freemium_type || undefined,
    vendorName: product.vendor_name || undefined,
    vendorUrl: product.vendor_url || undefined,
    type: product.type || undefined,
    hash: product.hash || undefined,
    isInstallable: product.is_installable,
    source: "woocommerce-api",
  };

  return {
    name,
    slug: product.slug || slug,
    averageRating: typeof product.rating === "number" ? product.rating : null,
    ratingCount: typeof product.reviews_count === "number" ? product.reviews_count : null,
    pricingHint,
    iconUrl,
    developer: product.vendor_name
      ? { name: product.vendor_name, url: product.vendor_url || undefined }
      : null,
    badges: buildBadges(product),
    platformData: platformData as unknown as Record<string, unknown>,
  };
}
