/**
 * One-off: Run keyword auto-suggestion scraper for all active keywords.
 *
 * Usage: npx tsx packages/db/src/scripts/run-suggestion-scraper.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../../.env") });

import { createDb } from "../index.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = createDb(databaseUrl);

// Dynamic import to avoid bundling scraper in db package
const { KeywordSuggestionScraper } = await import(
  "../../../../apps/scraper/src/scrapers/keyword-suggestion-scraper.js"
);

const scraper = new KeywordSuggestionScraper(db);
await scraper.scrapeAll("cli:manual");
console.log("Done");
process.exit(0);
