/**
 * One-off cleanup: delete Canva sub-category records that use simple slugs
 * (e.g. "forms", "ai-images") so they can be replaced by compound-slug
 * records (e.g. "project-management--forms", "ai-generation--ai-images")
 * on the next scrape.
 *
 * Also cleans up related category_snapshots and category_rankings rows.
 *
 * Usage: npx tsx packages/db/src/scripts/clean-canva-simple-slugs.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../../.env") });

import { sql } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(databaseUrl);
const db = drizzle(client);

async function clean() {
  // Find all Canva sub-categories (those with parent_slug set)
  const oldRecords = await db.execute(sql`
    SELECT id, slug, parent_slug, title
    FROM categories
    WHERE platform = 'canva' AND parent_slug IS NOT NULL
  `);

  console.log(`Found ${oldRecords.length} Canva sub-category records to clean:`);
  for (const row of oldRecords) {
    console.log(`  - [${row.id}] ${row.slug} (parent: ${row.parent_slug}) "${row.title}"`);
  }

  if (oldRecords.length === 0) {
    console.log("Nothing to clean.");
    await client.end();
    return;
  }

  // Delete category_snapshots for these categories
  await db.execute(sql`
    DELETE FROM category_snapshots
    WHERE category_id IN (
      SELECT id FROM categories WHERE platform = 'canva' AND parent_slug IS NOT NULL
    )
  `);
  console.log("Deleted related category_snapshots.");

  // Delete the categories themselves
  await db.execute(sql`
    DELETE FROM categories
    WHERE platform = 'canva' AND parent_slug IS NOT NULL
  `);
  console.log(`Deleted ${oldRecords.length} Canva sub-category records.`);

  await client.end();
  console.log("Done.");
}

clean().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
