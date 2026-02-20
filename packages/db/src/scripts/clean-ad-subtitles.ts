/**
 * One-off cleanup: nullify appCardSubtitle values that contain
 * Shopify ad boilerplate text (e.g. "The app developer paid to promote...").
 *
 * Usage: npx tsx packages/db/src/scripts/clean-ad-subtitles.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../../.env") });

import { like, or } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { apps } from "../schema/apps";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(databaseUrl);
const db = drizzle(client);

async function clean() {
  // Find all apps with ad boilerplate in their subtitle
  const dirty = await db
    .select({ slug: apps.slug, subtitle: apps.appCardSubtitle })
    .from(apps)
    .where(
      or(
        like(apps.appCardSubtitle, "%app developer paid to promote%"),
        like(apps.appCardSubtitle, "%This ad is based on%")
      )
    );

  console.log(`Found ${dirty.length} apps with ad text in subtitle:`);
  for (const row of dirty) {
    console.log(`  - ${row.slug}: "${row.subtitle}"`);
  }

  if (dirty.length === 0) {
    console.log("Nothing to clean.");
    await client.end();
    return;
  }

  // Nullify the ad subtitles
  const result = await db
    .update(apps)
    .set({ appCardSubtitle: null })
    .where(
      or(
        like(apps.appCardSubtitle, "%app developer paid to promote%"),
        like(apps.appCardSubtitle, "%This ad is based on%")
      )
    );

  console.log(`Cleaned ${dirty.length} subtitle(s).`);
  await client.end();
}

clean().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
