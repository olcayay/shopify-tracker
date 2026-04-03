/**
 * Standalone database migration runner.
 *
 * Usage:
 *   node packages/db/dist/migrate.js              # run pending migrations
 *   node packages/db/dist/migrate.js --dry-run    # list pending migrations without applying
 *
 * Requires DATABASE_URL environment variable.
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, readdirSync, existsSync } from "fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));

const dryRun = process.argv.includes("--dry-run");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("ERROR: DATABASE_URL environment variable is required");
  process.exit(1);
}

// Try dist/migrations first (when running compiled), then src/migrations (Docker/dev)
let migrationsFolder = resolve(__dirname, "./migrations");
if (!existsSync(migrationsFolder)) {
  // In Docker, migrations are copied to packages/db/src/migrations
  migrationsFolder = resolve(__dirname, "../src/migrations");
}
if (!existsSync(migrationsFolder)) {
  console.error(`ERROR: Migrations folder not found. Tried:\n  - ${resolve(__dirname, "./migrations")}\n  - ${resolve(__dirname, "../src/migrations")}`);
  process.exit(1);
}

async function run() {
  const client = postgres(databaseUrl!, { max: 1 });
  const db = drizzle(client);

  try {
    // Pre-migration: add enum values outside of transaction
    // (ALTER TYPE ... ADD VALUE cannot run inside a transaction block)
    if (!dryRun) {
      try {
        await db.execute(sql`ALTER TYPE scraper_type ADD VALUE IF NOT EXISTS 'compute_similarity_scores'`);
      } catch (e: any) {
        if (!e.message?.includes("already exists")) {
          console.error("Pre-migration enum error:", e.message);
        }
      }
    }

    if (dryRun) {
      // Read journal to show what migrations exist
      const journalPath = resolve(migrationsFolder, "meta/_journal.json");
      if (!existsSync(journalPath)) {
        console.error("ERROR: Migration journal not found");
        process.exit(1);
      }
      const journal = JSON.parse(readFileSync(journalPath, "utf-8"));
      const migrationFiles = journal.entries.map((e: { tag: string }) => e.tag);

      // Check which migrations have been applied
      let appliedMigrations: Set<string> = new Set();
      try {
        const result = await db.execute(sql`SELECT hash FROM __drizzle_migrations`);
        appliedMigrations = new Set(
          (result as any[]).map((r: any) => r.hash)
        );
      } catch {
        console.log("No migration table found — all migrations are pending.");
      }

      const sqlFiles = readdirSync(migrationsFolder).filter((f: string) => f.endsWith(".sql"));
      const pendingFiles = sqlFiles.filter((f: string) => !appliedMigrations.has(f.replace(".sql", "")));

      console.log(`Total migrations: ${migrationFiles.length}`);
      console.log(`Applied: ${appliedMigrations.size}`);
      console.log(`Pending: ${pendingFiles.length}`);

      if (pendingFiles.length > 0) {
        console.log("\nPending migrations:");
        for (const f of pendingFiles) {
          console.log(`  - ${f}`);
        }
      } else {
        console.log("\nDatabase is up to date.");
      }
    } else {
      console.log("Running database migrations...");
      await migrate(db, { migrationsFolder });
      console.log("Database migrations complete.");

      // Post-migration safety net: ensure critical columns exist.
      // Drizzle may skip migrations it believes are already applied (hash match)
      // even if the SQL never actually ran on this database. (PLA-647)
      const safetyStatements = [
        `ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "past_due_since" timestamp`,
      ];
      for (const stmt of safetyStatements) {
        try {
          await db.execute(sql.raw(stmt));
        } catch (e: any) {
          console.warn(`Safety-net statement failed (non-fatal): ${e.message}`);
        }
      }
    }
  } catch (err: any) {
    console.error("Migration ERROR:", err.message || String(err));
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
