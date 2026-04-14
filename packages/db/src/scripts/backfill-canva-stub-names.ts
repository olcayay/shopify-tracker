/**
 * One-off cleanup: null out Canva app names that are slug-derived stubs.
 *
 * Before commit 4981d36c, CanvaModule's `parseCanvaAppPage` fell through to
 * `fallback(slug)` when none of the three extraction paths (SSR detail JSON,
 * appListing API, bulk /apps JSON) matched the app id. That fallback
 * synthesised a name via `slug.split("--")[1]?.replace(/-/g, " ") || appId`,
 * producing lowercase-space-separated text like "jotform ai chatbot" that was
 * then persisted as `apps.name`. See PLA-1089.
 *
 * The parser is fixed going forward (throws CanvaAppNotFoundError instead of
 * returning a stub), but existing rows still carry the stub names. This
 * script NULLs `apps.name` for every Canva app whose stored name exactly
 * matches the slug-derived stub. A null name signals the next successful
 * app_details scrape to overwrite with the real parsed name.
 *
 * Usage: npx tsx packages/db/src/scripts/backfill-canva-stub-names.ts [--apply]
 * Without --apply: dry-run (prints matches, makes no changes).
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

const apply = process.argv.includes("--apply");
const client = postgres(databaseUrl);
const db = drizzle(client);

function slugStub(slug: string): string {
  const parts = slug.split("--");
  return (parts[1] || parts[0] || "").replace(/-/g, " ");
}

async function main() {
  const rows = await db.execute(sql`
    SELECT id, slug, name
    FROM apps
    WHERE platform = 'canva'
      AND name IS NOT NULL
      AND name ~ '^[a-z0-9 ]+$'
  `);

  const matches: Array<{ id: string; slug: string; name: string }> = [];
  for (const r of rows as unknown as Array<{ id: string; slug: string; name: string }>) {
    const stub = slugStub(r.slug);
    if (r.name === stub) matches.push(r);
  }

  console.log(`Scanned ${rows.length} candidate Canva apps (lowercase names)`);
  console.log(`Found ${matches.length} slug-stub matches:`);
  for (const m of matches.slice(0, 20)) {
    console.log(`  - ${m.slug} → name="${m.name}"`);
  }
  if (matches.length > 20) console.log(`  ... (+${matches.length - 20} more)`);

  if (!apply) {
    console.log("\nDry-run: pass --apply to null these names.");
    await client.end();
    return;
  }

  if (matches.length === 0) {
    console.log("\nNothing to update.");
    await client.end();
    return;
  }

  const ids = matches.map((m) => m.id);
  const result = await db.execute(sql`
    UPDATE apps SET name = NULL WHERE id = ANY(${ids}::uuid[])
  `);
  console.log(`\nUpdated ${result.count ?? matches.length} rows. Next successful app_details scrape will repopulate.`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
