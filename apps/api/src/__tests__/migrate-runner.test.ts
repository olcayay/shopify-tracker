import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const migrationsFolder = resolve(import.meta.dirname, "../../../../packages/db/src/migrations");

describe("standalone migration runner", () => {
  it("migrations folder exists", () => {
    expect(existsSync(migrationsFolder)).toBe(true);
  });

  it("migration journal is valid with required fields", () => {
    const journalPath = resolve(migrationsFolder, "meta/_journal.json");
    expect(existsSync(journalPath)).toBe(true);

    const journal = JSON.parse(readFileSync(journalPath, "utf-8"));
    expect(journal).toHaveProperty("entries");
    expect(Array.isArray(journal.entries)).toBe(true);
    expect(journal.entries.length).toBeGreaterThan(0);

    for (const entry of journal.entries) {
      expect(entry).toHaveProperty("idx");
      expect(entry).toHaveProperty("version");
      expect(entry).toHaveProperty("when");
      expect(entry).toHaveProperty("tag");
    }
  });

  it("every journal entry has a matching .sql file", () => {
    const journalPath = resolve(migrationsFolder, "meta/_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf-8"));

    for (const entry of journal.entries) {
      const sqlFile = resolve(migrationsFolder, `${entry.tag}.sql`);
      expect(existsSync(sqlFile), `Missing SQL file: ${entry.tag}.sql`).toBe(true);
    }
  });

  it("migrate.ts source file exists", () => {
    const migrateSrc = resolve(import.meta.dirname, "../../../../packages/db/src/migrate.ts");
    expect(existsSync(migrateSrc)).toBe(true);
  });

  it("API index.ts no longer imports migrate from drizzle", () => {
    const indexSrc = readFileSync(
      resolve(import.meta.dirname, "../index.ts"),
      "utf-8",
    );
    expect(indexSrc).not.toContain("from \"drizzle-orm/postgres-js/migrator\"");
    expect(indexSrc).not.toContain("migrationsFolder");
  });
});
