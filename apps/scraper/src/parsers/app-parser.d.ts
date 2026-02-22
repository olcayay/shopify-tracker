import { type AppDetails } from "@shopify-tracking/shared";
/**
 * Parse an app detail page and extract all available data.
 * Uses JSON-LD structured data for rating/name, HTML for the rest.
 */
export declare function parseAppPage(html: string, slug: string): AppDetails;
export interface SimilarApp {
    slug: string;
    name: string;
    icon_url: string;
    position?: number;
}
/**
 * Parse the "More apps like this" section from an app detail page.
 * App cards use data-controller="app-card" with standard data attributes.
 */
export declare function parseSimilarApps(html: string): SimilarApp[];
//# sourceMappingURL=app-parser.d.ts.map