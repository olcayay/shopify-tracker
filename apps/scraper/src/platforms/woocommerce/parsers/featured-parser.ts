import type { NormalizedFeaturedSection } from "../../platform-module.js";

interface WooCommerceFeaturedProduct {
  title?: string;
  slug?: string;
  icon?: string;
  image?: string;
}

interface WooCommerceFeaturedSectionRaw {
  title?: string;
  module?: string;
  products?: WooCommerceFeaturedProduct[];
}

interface WooCommerceFeaturedResponse {
  sections?: WooCommerceFeaturedSectionRaw[];
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Parse the WooCommerce /featured API response into normalized sections. */
export function parseWooCommerceFeaturedSections(json: string): NormalizedFeaturedSection[] {
  const data: WooCommerceFeaturedResponse = JSON.parse(json);
  const sections = data.sections ?? [];

  return sections
    .filter((s) => s.products && s.products.length > 0)
    .map((section) => {
      const sectionTitle = section.title || section.module || "Featured";
      const sectionHandle = slugify(sectionTitle);

      return {
        sectionHandle,
        sectionTitle,
        surface: "homepage",
        surfaceDetail: "woocommerce-marketplace-homepage",
        apps: (section.products ?? []).map((product, idx) => ({
          slug: product.slug || "",
          name: product.title || "",
          iconUrl: product.icon || product.image || "",
          position: idx + 1,
        })),
      };
    });
}
