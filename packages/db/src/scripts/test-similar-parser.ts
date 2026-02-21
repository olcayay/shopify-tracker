/**
 * Quick test: parse "More apps like this" from a live Shopify page.
 * Usage: npx tsx packages/db/src/scripts/test-similar-parser.ts
 */
import { parseSimilarApps } from "../../../../apps/scraper/src/parsers/app-parser.js";

const res = await fetch("https://apps.shopify.com/jotform-ai-chatbot", {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  },
});
const html = await res.text();
const result = parseSimilarApps(html);
console.log("Similar apps found:", result.length);
console.log(JSON.stringify(result, null, 2));
process.exit(0);
