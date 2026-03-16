import { createLogger } from "@appranks/shared";
import type { NormalizedCategoryPage, NormalizedCategoryApp } from "../../platform-module.js";
import { extractReactQueryState } from "./app-parser.js";

const log = createLogger("wix-category-parser");

/** Parse Wix category page HTML into normalized format */
export function parseWixCategoryPage(
  html: string,
  categorySlug: string,
  page: number,
  offset: number,
): NormalizedCategoryPage {
  const state = extractReactQueryState(html);

  // Try L1 category-page query first
  let data: any = null;
  let headerData: any = null;
  if (state?.queries) {
    for (const q of state.queries) {
      const key = Array.isArray(q.queryKey) ? q.queryKey[0] : q.queryKey;
      if (typeof key === "string" && key.startsWith("category-page-")) {
        data = q.state?.data;
        break;
      }
    }
    // L2 subcategory: uses "initial-apps-fetch-*" for apps and "sub-category-header-*" for metadata
    if (!data) {
      for (const q of state.queries) {
        const key = Array.isArray(q.queryKey) ? q.queryKey[0] : q.queryKey;
        if (typeof key === "string" && key.startsWith("initial-apps-fetch-")) {
          data = q.state?.data;
        }
        if (typeof key === "string" && key.startsWith("sub-category-header-")) {
          headerData = q.state?.data;
        }
      }
    }
  }

  // Extract subcategory links from the sidebar (works for all page types)
  const sidebarSubcategoryLinks = extractSidebarSubcategories(state, categorySlug);

  // L2 subcategory page: flat list of apps
  if (data?.appGroup && !data.appGroupSections) {
    const result = parseSubcategoryPage(data, headerData, categorySlug, offset);
    // Merge sidebar subcategory links if this category is also a parent
    if (sidebarSubcategoryLinks.length > 0) {
      result.subcategoryLinks = sidebarSubcategoryLinks;
    }
    return result;
  }

  if (!data) {
    // Virtual category (e.g. media--content): no apps, but has subcategory links from sidebar
    if (sidebarSubcategoryLinks.length > 0) {
      const sidebarTitle = extractSidebarCategoryTitle(state, categorySlug);
      return {
        slug: categorySlug,
        url: `https://www.wix.com/app-market/category/${categorySlug.replace("--", "/")}`,
        title: sidebarTitle || categorySlug,
        description: "",
        appCount: 0,
        apps: [],
        subcategoryLinks: sidebarSubcategoryLinks,
        hasNextPage: false,
      };
    }

    log.warn("no category JSON data found", { categorySlug });
    return {
      slug: categorySlug,
      url: `https://www.wix.com/app-market/category/${categorySlug.replace("--", "/")}`,
      title: categorySlug,
      description: "",
      appCount: null,
      apps: [],
      subcategoryLinks: [],
      hasNextPage: false,
    };
  }

  // L1 category page: grouped sections
  const category = data.category;
  const sections = data.appGroupSections ?? [];

  // Flatten all apps from all sections, tracking position
  const apps: NormalizedCategoryApp[] = [];
  const subcategoryLinks: { slug: string; url: string; title: string; parentSlug?: string }[] = [];
  let position = offset;

  for (const section of sections) {
    const tagSlug = section.tagSlug;
    const sectionTitle = section.title;

    // Add subcategory link
    if (tagSlug && sectionTitle) {
      const parentSlug = categorySlug.includes("--") ? categorySlug.split("--")[0] : categorySlug;
      const compoundSlug = `${parentSlug}--${tagSlug}`;
      subcategoryLinks.push({
        slug: compoundSlug,
        url: `https://www.wix.com/app-market/category/${parentSlug}/${tagSlug}`,
        title: sectionTitle,
        parentSlug: categorySlug,
      });
    }

    for (const app of section.apps ?? []) {
      position++;
      apps.push(normalizeAppCard(app, position));
    }
  }

  return {
    slug: categorySlug,
    url: `https://www.wix.com/app-market/category/${categorySlug.replace("--", "/")}`,
    title: category?.name?.trim() || categorySlug,
    description: category?.description || "",
    appCount: apps.length,
    apps,
    subcategoryLinks,
    hasNextPage: false, // All apps on one page
  };
}

/** Parse L2 subcategory page (flat list of apps, no sections) */
function parseSubcategoryPage(
  data: any,
  headerData: any,
  categorySlug: string,
  offset: number,
): NormalizedCategoryPage {
  const apps: NormalizedCategoryApp[] = [];
  let position = offset;

  const appList = data.appGroup?.apps ?? [];
  for (const app of appList) {
    position++;
    apps.push(normalizeAppCard(app, position));
  }

  const title =
    headerData?.primaryTitle?.trim() ||
    data.appGroup?.title?.trim() ||
    data.collectionName?.trim() ||
    categorySlug;

  const paging = data.paging;
  const hasNextPage = paging?.hasNext === true;

  return {
    slug: categorySlug,
    url: `https://www.wix.com/app-market/category/${categorySlug.replace("--", "/")}`,
    title,
    description: "",
    appCount: paging?.total ?? apps.length,
    apps,
    subcategoryLinks: [],
    hasNextPage,
  };
}

/**
 * Extract subcategory links from the app-market-sidebar query.
 * Works for all page types — the sidebar always contains the full category tree.
 */
function extractSidebarSubcategories(
  state: any,
  categorySlug: string,
): { slug: string; url: string; title: string; parentSlug?: string }[] {
  if (!state?.queries) return [];

  let sidebarData: any = null;
  for (const q of state.queries) {
    const key = Array.isArray(q.queryKey) ? q.queryKey[0] : q.queryKey;
    if (key === "app-market-sidebar") {
      sidebarData = q.state?.data;
      break;
    }
  }
  if (!sidebarData) return [];

  // Sidebar data is an array of arrays. First array has category links.
  const items = sidebarData[0] ?? [];
  for (const item of items) {
    if (item.type !== "CATEGORY_LINK") continue;
    const cat = item.categoryLink;
    if (!cat) continue;

    // Match by slug: categorySlug could be "marketing" or "booking--events"
    const catCompoundSlug = cat.parentCategorySlug
      ? `${cat.parentCategorySlug}--${cat.slug}`
      : cat.slug;

    if (catCompoundSlug === categorySlug) {
      const subLinks = cat.subCategoryLinks ?? [];
      return subLinks.map((sub: any) => {
        const parentSlug = sub.parentCategorySlug || cat.slug;
        const compoundSlug = `${parentSlug}--${sub.slug}`;
        return {
          slug: compoundSlug,
          url: `https://www.wix.com/app-market/category/${parentSlug}/${sub.slug}`,
          title: sub.label,
          parentSlug: categorySlug,
        };
      });
    }
  }

  return [];
}

/** Extract category title from the sidebar data */
function extractSidebarCategoryTitle(state: any, categorySlug: string): string | null {
  if (!state?.queries) return null;

  let sidebarData: any = null;
  for (const q of state.queries) {
    const key = Array.isArray(q.queryKey) ? q.queryKey[0] : q.queryKey;
    if (key === "app-market-sidebar") {
      sidebarData = q.state?.data;
      break;
    }
  }
  if (!sidebarData) return null;

  const items = sidebarData[0] ?? [];
  for (const item of items) {
    if (item.type !== "CATEGORY_LINK") continue;
    const cat = item.categoryLink;
    if (!cat) continue;
    const catCompoundSlug = cat.parentCategorySlug
      ? `${cat.parentCategorySlug}--${cat.slug}`
      : cat.slug;
    if (catCompoundSlug === categorySlug) return cat.label;
  }
  return null;
}

/** Normalize an app card from JSON (shared between category and search) */
export function normalizeAppCard(app: any, position: number): NormalizedCategoryApp {
  let pricingHint: string | undefined;
  const pricingType = app.pricing?.label?.type;
  if (pricingType === "FREE") pricingHint = "Free";
  else if (pricingType === "FREE_PLAN_AVAILABLE") pricingHint = "Free plan available";
  else if (pricingType) pricingHint = "Paid";

  return {
    slug: app.slug || "",
    name: app.name || "",
    shortDescription: app.shortDescription || "",
    averageRating: app.reviews?.averageRating ?? 0,
    ratingCount: app.reviews?.totalCount ?? 0,
    logoUrl: app.icon || "",
    pricingHint,
    position,
    isSponsored: false,
    badges: (app.appBadges ?? []).map((b: any) => b.badge),
  };
}
