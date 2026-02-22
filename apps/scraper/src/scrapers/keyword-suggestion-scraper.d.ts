import type { Database } from "@shopify-tracking/db";
import { HttpClient } from "../http-client.js";
export declare class KeywordSuggestionScraper {
    private db;
    private httpClient;
    constructor(db: Database, httpClient?: HttpClient);
    /** Scrape autocomplete suggestions for all active keywords */
    scrapeAll(triggeredBy?: string): Promise<void>;
    /** Scrape autocomplete suggestions for a single keyword */
    scrapeSuggestions(keywordId: number, keyword: string, runId: string): Promise<string[]>;
}
//# sourceMappingURL=keyword-suggestion-scraper.d.ts.map