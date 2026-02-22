import type { Database } from "@shopify-tracking/db";
import { HttpClient } from "../http-client.js";
export declare class AppDetailsScraper {
    private db;
    private httpClient;
    constructor(db: Database, httpClient?: HttpClient);
    /** Scrape details for all tracked apps */
    scrapeTracked(triggeredBy?: string): Promise<void>;
    /** Scrape a single app by slug */
    scrapeApp(slug: string, runId?: string, triggeredBy?: string): Promise<void>;
}
//# sourceMappingURL=app-details-scraper.d.ts.map