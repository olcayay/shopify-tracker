/**
 * Scrape similar apps for jotform + all its competitors + their similar apps.
 * Usage: npx tsx packages/db/src/scripts/test-similar-scrape.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../../.env") });

import { createDb } from "../index.js";
import { sql } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = createDb(databaseUrl);

const { AppDetailsScraper } = await import(
  "../../../../apps/scraper/src/scrapers/app-details-scraper.js"
);

const scraper = new AppDetailsScraper(db);

// Step 1: Get jotform's competitors + existing similar apps
const rawResult = await db.execute(sql`
  SELECT DISTINCT slug FROM (
    SELECT sa.similar_app_slug as slug
    FROM similar_app_sightings sa
    WHERE sa.app_slug = 'jotform-ai-chatbot'
    UNION
    SELECT ac.app_slug as slug
    FROM account_competitor_apps ac
    JOIN account_tracked_apps at2 ON at2.account_id = ac.account_id AND at2.app_slug = 'jotform-ai-chatbot'
  ) t
`);
const level1Slugs: string[] = ((rawResult as any).rows ?? rawResult).map((r: any) => r.slug);
console.log(`Level 1: ${level1Slugs.length} apps to scrape:`, level1Slugs);

// Step 2: Scrape level 1 apps (competitors + similar)
for (const slug of level1Slugs) {
  try {
    await scraper.scrapeApp(slug, undefined, "cli:similar-deep");
    console.log(`✓ ${slug}`);
  } catch (err) {
    console.log(`✗ ${slug}: ${String(err).slice(0, 80)}`);
  }
}

// Step 3: Get newly discovered similar apps (level 2)
const level2Result = await db.execute(sql`
  SELECT DISTINCT sa.similar_app_slug as slug
  FROM similar_app_sightings sa
  WHERE sa.app_slug IN (${sql.join(level1Slugs.map(s => sql`${s}`), sql`, `)})
    AND sa.similar_app_slug != 'jotform-ai-chatbot'
    AND sa.similar_app_slug NOT IN (${sql.join(level1Slugs.map(s => sql`${s}`), sql`, `)})
`);
const level2Slugs: string[] = ((level2Result as any).rows ?? level2Result).map((r: any) => r.slug);
console.log(`\nLevel 2: ${level2Slugs.length} new apps discovered:`, level2Slugs);

// Step 4: Scrape level 2 apps
for (const slug of level2Slugs) {
  try {
    await scraper.scrapeApp(slug, undefined, "cli:similar-deep-l2");
    console.log(`✓ ${slug}`);
  } catch (err) {
    console.log(`✗ ${slug}: ${String(err).slice(0, 80)}`);
  }
}

// Summary
const countResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM similar_app_sightings`);
const count = ((countResult as any).rows ?? countResult)[0].cnt;
console.log(`\nDone. Total sightings: ${count}`);

process.exit(0);
