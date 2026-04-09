/**
 * Migration integrity tests — verify that:
 * 1. Every journal entry has a corresponding SQL file
 * 2. SQL files use safe patterns (IF NOT EXISTS, CONCURRENTLY)
 * 3. Critical columns are defined in the schema
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, "../migrations");
const journalPath = resolve(migrationsDir, "meta/_journal.json");

describe("Migration integrity", () => {
  it("journal file exists", () => {
    expect(existsSync(journalPath)).toBe(true);
  });

  it("every journal entry has a corresponding SQL file", () => {
    const journal = JSON.parse(readFileSync(journalPath, "utf-8"));
    for (const entry of journal.entries) {
      const sqlFile = resolve(migrationsDir, `${entry.tag}.sql`);
      expect(existsSync(sqlFile), `Missing SQL file for journal entry: ${entry.tag}`).toBe(true);
    }
  });

  it("no orphan SQL files without journal entry", () => {
    const journal = JSON.parse(readFileSync(journalPath, "utf-8"));
    const journalTags = new Set(journal.entries.map((e: any) => e.tag));
    const sqlFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.replace(".sql", ""));

    for (const file of sqlFiles) {
      expect(journalTags.has(file), `Orphan SQL file without journal entry: ${file}.sql`).toBe(true);
    }
  });

  it("journal entries have sequential idx values", () => {
    const journal = JSON.parse(readFileSync(journalPath, "utf-8"));
    for (let i = 0; i < journal.entries.length; i++) {
      expect(journal.entries[i].idx).toBe(i);
    }
  });

  it("recent ALTER TABLE ADD COLUMN statements use IF NOT EXISTS (migrations >= 0100)", () => {
    const sqlFiles = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    for (const file of sqlFiles) {
      const migNum = parseInt(file.split("_")[0], 10);
      if (migNum < 100) continue; // Only enforce for recent migrations

      const content = readFileSync(resolve(migrationsDir, file), "utf-8");
      const alterLines = content
        .split("\n")
        .filter((l) => /ALTER TABLE/i.test(l) && /ADD COLUMN/i.test(l));

      for (const line of alterLines) {
        expect(
          /IF NOT EXISTS/i.test(line),
          `ALTER TABLE ADD COLUMN without IF NOT EXISTS in ${file}: ${line.trim()}`
        ).toBe(true);
      }
    }
  });

  it("recent CREATE TABLE statements use IF NOT EXISTS (migrations >= 0100)", () => {
    const sqlFiles = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    for (const file of sqlFiles) {
      const migNum = parseInt(file.split("_")[0], 10);
      if (migNum < 100) continue; // Only enforce for recent migrations

      const content = readFileSync(resolve(migrationsDir, file), "utf-8");
      const createLines = content
        .split("\n")
        .filter((l) => /CREATE TABLE/i.test(l) && !/CREATE TABLE IF NOT EXISTS/i.test(l));

      expect(
        createLines.length,
        `CREATE TABLE without IF NOT EXISTS in ${file}`
      ).toBe(0);
    }
  });
  it("no migration uses CONCURRENTLY (incompatible with Drizzle transaction wrapper)", () => {
    const sqlFiles = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    for (const file of sqlFiles) {
      const content = readFileSync(resolve(migrationsDir, file), "utf-8");
      const concurrentlyLines = content
        .split("\n")
        .filter((l) => /CONCURRENTLY/i.test(l) && !/^--/.test(l.trim()));

      expect(
        concurrentlyLines.length,
        `CONCURRENTLY found in ${file} — Drizzle runs migrations in transactions, CONCURRENTLY is not allowed. Use plain CREATE INDEX IF NOT EXISTS instead.`
      ).toBe(0);
    }
  });
});

describe("Schema critical columns", () => {
  // Import all schema exports to verify they compile
  it("schema exports compile without errors", async () => {
    const schema = await import("../index.js");
    expect(schema).toBeDefined();
    expect(schema.createDb).toBeTypeOf("function");
  });

  it("accounts table has billing columns", async () => {
    const { accounts } = await import("../schema/auth.js");
    expect(accounts).toBeDefined();
    // Verify key columns exist in the table definition
    const columnNames = Object.keys(accounts);
    expect(columnNames).toContain("stripeCustomerId");
    expect(columnNames).toContain("subscriptionStatus");
    expect(columnNames).toContain("pastDueSince");
  });

  it("users table has emailVerifiedAt column", async () => {
    const { users } = await import("../schema/auth.js");
    const columnNames = Object.keys(users);
    expect(columnNames).toContain("emailVerifiedAt");
  });

  it("refresh tokens table has userAgentHash column", async () => {
    const { refreshTokens } = await import("../schema/auth.js");
    const columnNames = Object.keys(refreshTokens);
    expect(columnNames).toContain("userAgentHash");
  });

  it("password reset tokens table exists", async () => {
    const { passwordResetTokens } = await import("../schema/auth.js");
    expect(passwordResetTokens).toBeDefined();
  });

  it("email verification tokens table exists", async () => {
    const { emailVerificationTokens } = await import("../schema/auth.js");
    expect(emailVerificationTokens).toBeDefined();
  });

  it("account activity log table exists", async () => {
    const { accountActivityLog } = await import("../schema/activity-log.js");
    expect(accountActivityLog).toBeDefined();
  });

  it("support tickets tables exist in schema", async () => {
    const { supportTickets, supportTicketMessages, supportTicketAttachments } =
      await import("../schema/support-tickets.js");
    expect(supportTickets).toBeDefined();
    expect(supportTicketMessages).toBeDefined();
    expect(supportTicketAttachments).toBeDefined();
  });
});

describe("Safety-net coverage", () => {
  it("migrate.ts safety-net covers all CREATE TABLE from recent migrations (>= 0120)", () => {
    const migrateContent = readFileSync(
      resolve(__dirname, "../migrate.ts"),
      "utf-8"
    );
    const sqlFiles = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));

    for (const file of sqlFiles) {
      const migNum = parseInt(file.split("_")[0], 10);
      if (migNum < 120) continue; // Only enforce for very recent migrations

      const content = readFileSync(resolve(migrationsDir, file), "utf-8");
      const createTableMatches = content.match(
        /CREATE TABLE IF NOT EXISTS\s+(\w+)/gi
      );
      if (!createTableMatches) continue;

      for (const match of createTableMatches) {
        const tableName = match
          .replace(/CREATE TABLE IF NOT EXISTS\s+/i, "")
          .trim();
        expect(
          migrateContent.includes(tableName),
          `Table "${tableName}" from ${file} is not covered by the safety-net in migrate.ts. ` +
            `Add a CREATE TABLE IF NOT EXISTS statement to the safetyStatements array to prevent the Drizzle hash-match bug (PLA-647, PLA-957).`
        ).toBe(true);
      }
    }
  });
});
