import { createLogger } from "@appranks/shared";
import type { NormalizedSearchPage, NormalizedSearchApp } from "../../platform-module.js";
import { extractReactQueryState } from "./app-parser.js";

const log = createLogger("wix-search-parser");

/** Parse Wix search results page HTML into normalized format */
export function parseWixSearchPage(
  html: string,
  keyword: string,
  page: number,
  offset: number,
): NormalizedSearchPage {
  const state = extractReactQueryState(html);

  // Find search query data (key starts with "initial-apps-fetch-")
  let data: any = null;
  if (state?.queries) {
    for (const q of state.queries) {
      const key = Array.isArray(q.queryKey) ? q.queryKey[0] : q.queryKey;
      if (typeof key === "string" && key.startsWith("initial-apps-fetch-")) {
        data = q.state?.data;
        break;
      }
    }
  }

  if (!data) {
    log.warn("no search JSON data found", { keyword });
    return {
      keyword,
      totalResults: null,
      apps: [],
      hasNextPage: false,
      currentPage: page,
    };
  }

  const appGroup = data.appGroup;
  const paging = data.paging;
  const rawApps = appGroup?.apps ?? [];

  const apps: NormalizedSearchApp[] = rawApps.map((app: any, index: number) => {
    const position = offset + index + 1;
    let pricingHint: string | undefined;
    const pricingType = app.pricing?.label?.type;
    if (pricingType === "FREE") pricingHint = "Free";
    else if (pricingType === "FREE_PLAN_AVAILABLE") pricingHint = "Free plan available";
    else if (pricingType) pricingHint = "Paid";

    return {
      position,
      appSlug: app.slug || "",
      appName: app.name || "",
      shortDescription: app.shortDescription || "",
      averageRating: app.reviews?.averageRating ?? 0,
      ratingCount: app.reviews?.totalCount ?? 0,
      logoUrl: app.icon || "",
      pricingHint,
      isSponsored: false,
      badges: (app.appBadges ?? []).map((b: any) => b.badge),
    };
  });

  return {
    keyword,
    totalResults: paging?.total ?? apps.length,
    apps,
    hasNextPage: paging?.hasNext ?? false,
    currentPage: page,
  };
}
