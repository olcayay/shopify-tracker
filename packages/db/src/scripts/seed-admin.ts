/**
 * Seed script: creates default account + system admin user,
 * migrates existing tracked apps/keywords to account tracking tables.
 *
 * Usage: npx tsx packages/db/src/scripts/seed-admin.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../../.env") });

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { accounts } from "../schema/auth";
import { users } from "../schema/auth";
import { apps } from "../schema/apps";
import { trackedKeywords } from "../schema/keywords";
import { accountTrackedApps } from "../schema/account-tracking";
import { accountTrackedKeywords } from "../schema/account-tracking";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const adminEmail: string = process.env.ADMIN_EMAIL!;
const adminPassword: string = process.env.ADMIN_PASSWORD!;
if (!adminEmail || !adminPassword) {
  console.error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
  process.exit(1);
}

const client = postgres(databaseUrl);
const db = drizzle(client);

async function seed() {
  console.log("Seeding database...");

  // 1. Check if default account already exists
  const existingAccounts = await db.select().from(accounts).limit(1);
  if (existingAccounts.length > 0) {
    console.log("Accounts already exist, skipping seed.");
    await client.end();
    return;
  }

  // 2. Create default account with generous limits
  const [account] = await db
    .insert(accounts)
    .values({
      name: "Default Account",
      maxTrackedApps: 100,
      maxTrackedKeywords: 100,
      maxCompetitorApps: 50,
    })
    .returning();
  console.log(`Created account: ${account.name} (${account.id})`);

  // 3. Create system admin user
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const [admin] = await db
    .insert(users)
    .values({
      email: adminEmail.toLowerCase(),
      passwordHash,
      name: "System Admin",
      accountId: account.id,
      role: "owner",
      isSystemAdmin: true,
    })
    .returning();
  console.log(`Created admin user: ${admin.email} (${admin.id})`);

  // 4. Migrate existing tracked apps
  const trackedApps = await db
    .select({ slug: apps.slug })
    .from(apps)
    .where(eq(apps.isTracked, true));

  if (trackedApps.length > 0) {
    await db.insert(accountTrackedApps).values(
      trackedApps.map((a) => ({
        accountId: account.id,
        appSlug: a.slug,
      }))
    );
    console.log(`Migrated ${trackedApps.length} tracked apps to account`);
  }

  // 5. Migrate existing active keywords
  const activeKeywords = await db
    .select({ id: trackedKeywords.id })
    .from(trackedKeywords)
    .where(eq(trackedKeywords.isActive, true));

  if (activeKeywords.length > 0) {
    await db.insert(accountTrackedKeywords).values(
      activeKeywords.map((k) => ({
        accountId: account.id,
        keywordId: k.id,
      }))
    );
    console.log(
      `Migrated ${activeKeywords.length} tracked keywords to account`
    );
  }

  console.log("Seed complete!");
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
