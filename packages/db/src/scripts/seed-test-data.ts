/**
 * Database seed script for development test data.
 *
 * Usage:
 *   npx tsx packages/db/src/scripts/seed-test-data.ts
 *
 * Creates:
 * - 3 test accounts (Free, Pro, Business) with owners
 * - 5 additional users across accounts
 * - Sample tracked apps, keywords, and competitors
 *
 * Idempotent: uses ON CONFLICT DO NOTHING for all inserts.
 * Requires DATABASE_URL environment variable.
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../../.env") });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(databaseUrl);
const db = drizzle(client);

const PASSWORD_HASH = bcrypt.hashSync("Password123", 12);

async function seed() {
  console.log("🌱 Seeding test data...");

  // Create 3 accounts
  const accounts = [
    { name: "Free Team", company: "FreeStartup Inc", maxTrackedApps: 3, maxTrackedKeywords: 5, maxUsers: 1, maxPlatforms: 1 },
    { name: "Pro Team", company: "ProCorp", maxTrackedApps: 25, maxTrackedKeywords: 50, maxUsers: 3, maxPlatforms: 3 },
    { name: "Business Team", company: "Enterprise Ltd", maxTrackedApps: 100, maxTrackedKeywords: 200, maxUsers: 10, maxPlatforms: 11 },
  ];

  for (const acct of accounts) {
    await db.execute(sql`
      INSERT INTO accounts (name, company, max_tracked_apps, max_tracked_keywords, max_users, max_platforms)
      VALUES (${acct.name}, ${acct.company}, ${acct.maxTrackedApps}, ${acct.maxTrackedKeywords}, ${acct.maxUsers}, ${acct.maxPlatforms})
      ON CONFLICT DO NOTHING
    `);
  }

  // Get account IDs
  const acctRows = await db.execute(sql`SELECT id, name FROM accounts WHERE name IN ('Free Team', 'Pro Team', 'Business Team') ORDER BY name`);
  const acctIds = (acctRows as any[]).reduce((m: Record<string, string>, r: any) => ({ ...m, [r.name]: r.id }), {});

  // Create users
  const users = [
    { email: "free@test.com", name: "Free User", accountId: acctIds["Free Team"], role: "owner" },
    { email: "pro-owner@test.com", name: "Pro Owner", accountId: acctIds["Pro Team"], role: "owner" },
    { email: "pro-editor@test.com", name: "Pro Editor", accountId: acctIds["Pro Team"], role: "editor" },
    { email: "pro-viewer@test.com", name: "Pro Viewer", accountId: acctIds["Pro Team"], role: "viewer" },
    { email: "biz-owner@test.com", name: "Business Owner", accountId: acctIds["Business Team"], role: "owner" },
    { email: "biz-editor@test.com", name: "Business Editor", accountId: acctIds["Business Team"], role: "editor" },
  ];

  for (const u of users) {
    if (!u.accountId) continue;
    await db.execute(sql`
      INSERT INTO users (email, password_hash, name, account_id, role)
      VALUES (${u.email}, ${PASSWORD_HASH}, ${u.name}, ${u.accountId}, ${u.role})
      ON CONFLICT (email) DO NOTHING
    `);
  }

  // Enable platforms for Pro and Business accounts
  if (acctIds["Pro Team"]) {
    for (const p of ["shopify", "wordpress", "wix"]) {
      await db.execute(sql`
        INSERT INTO account_platforms (account_id, platform)
        VALUES (${acctIds["Pro Team"]}, ${p})
        ON CONFLICT DO NOTHING
      `);
    }
  }

  if (acctIds["Business Team"]) {
    for (const p of ["shopify", "wordpress", "wix", "salesforce", "atlassian", "hubspot", "google_workspace", "zoom", "zoho", "zendesk", "canva"]) {
      await db.execute(sql`
        INSERT INTO account_platforms (account_id, platform)
        VALUES (${acctIds["Business Team"]}, ${p})
        ON CONFLICT DO NOTHING
      `);
    }
  }

  console.log("✅ Seed complete!");
  console.log("   Accounts:", Object.keys(acctIds).length);
  console.log("   Users:", users.length);
  console.log("\n   Login with any test user: email/Password123");

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
