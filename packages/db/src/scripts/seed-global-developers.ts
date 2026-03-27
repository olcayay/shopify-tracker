/**
 * Seed script: populates global_developers and platform_developers from existing
 * app snapshot developer data.
 *
 * Usage: npx tsx packages/db/src/scripts/seed-global-developers.ts
 *
 * Safe to re-run: uses ON CONFLICT DO NOTHING.
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../../.env") });

import { sql } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { ensurePlatformDeveloper } from "../ensure-platform-developer";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(databaseUrl);
const db = drizzle(client);

interface DeveloperRow {
  platform: string;
  developer_name: string;
  developer_website: string | null;
}

async function seed() {
  console.log("Seeding global developers from existing snapshots...");

  // Get distinct (platform, developer_name) from latest snapshots
  const rows = await db.execute<DeveloperRow>(sql`
    SELECT DISTINCT ON (a.platform, s.developer->>'name')
      a.platform,
      s.developer->>'name' AS developer_name,
      COALESCE(
        s.developer->>'website',
        s.developer->>'url',
        s.platform_data->>'developerWebsite',
        (s.platform_data->'publisher'->>'website')
      ) AS developer_website
    FROM app_snapshots s
    JOIN apps a ON a.id = s.app_id
    WHERE s.developer->>'name' IS NOT NULL
      AND s.developer->>'name' != ''
    ORDER BY a.platform, s.developer->>'name', s.scraped_at DESC
  `);

  console.log(`Found ${rows.length} distinct platform developers`);

  let created = 0;
  let linked = 0;

  for (const row of rows) {
    const globalId = await ensurePlatformDeveloper(
      db,
      row.platform,
      row.developer_name,
      row.developer_website
    );
    if (globalId > 0) {
      created++;
    }
  }

  // Count results
  const [globalCount] = await db.execute<{ count: string }>(
    sql`SELECT COUNT(*) as count FROM global_developers`
  );
  const [platformCount] = await db.execute<{ count: string }>(
    sql`SELECT COUNT(*) as count FROM platform_developers`
  );

  console.log(`Done! Created ${globalCount!.count} global developers, ${platformCount!.count} platform developer links`);
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
