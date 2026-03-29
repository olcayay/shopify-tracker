import { describe, it, expect } from "vitest";
import * as schema from "../schema/apps.js";
import * as authSchema from "../schema/auth.js";
import * as emailSchema from "../schema/email.js";
import * as notifSchema from "../schema/notifications.js";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

describe("Schema validation", () => {
  it("apps table has required columns", () => {
    const columns = Object.keys(schema.apps);
    expect(columns).toContain("id");
    expect(columns).toContain("slug");
    expect(columns).toContain("name");
    expect(columns).toContain("platform");
    expect(columns).toContain("averageRating");
  });

  it("appSnapshots table has required columns", () => {
    const columns = Object.keys(schema.appSnapshots);
    expect(columns).toContain("id");
    expect(columns).toContain("appId");
    expect(columns).toContain("screenshots");
    expect(columns).toContain("features");
    expect(columns).toContain("categories");
  });

  it("users table has auth fields", () => {
    const columns = Object.keys(authSchema.users);
    expect(columns).toContain("id");
    expect(columns).toContain("email");
    expect(columns).toContain("timezone");
    expect(columns).toContain("lastDigestSentAt");
  });

  it("emailLogs table has tracking fields", () => {
    const columns = Object.keys(emailSchema.emailLogs);
    expect(columns).toContain("openedAt");
    expect(columns).toContain("clickedAt");
    expect(columns).toContain("status");
  });

  it("notifications table has required fields", () => {
    const columns = Object.keys(notifSchema.notifications);
    expect(columns).toContain("type");
    expect(columns).toContain("category");
    expect(columns).toContain("priority");
    expect(columns).toContain("isRead");
  });
});

describe("Migration journal validation", () => {
  const journalPath = join(__dirname, "../migrations/meta/_journal.json");

  it("journal file exists", () => {
    expect(existsSync(journalPath)).toBe(true);
  });

  it("journal entries have sequential indices", () => {
    const journal = JSON.parse(readFileSync(journalPath, "utf-8"));
    for (let i = 0; i < journal.entries.length; i++) {
      expect(journal.entries[i].idx).toBe(i);
    }
  });

  it("all journal entries have matching migration files", () => {
    const journal = JSON.parse(readFileSync(journalPath, "utf-8"));
    const migrationsDir = join(__dirname, "../migrations");

    for (const entry of journal.entries) {
      const filePath = join(migrationsDir, `${entry.tag}.sql`);
      expect(existsSync(filePath)).toBe(true);
    }
  });

  it("journal entries have valid format", () => {
    const journal = JSON.parse(readFileSync(journalPath, "utf-8"));
    for (const entry of journal.entries) {
      expect(entry.version).toBe("7");
      expect(entry.breakpoints).toBe(true);
      expect(typeof entry.when).toBe("number");
      expect(typeof entry.tag).toBe("string");
    }
  });

  it("no orphaned migration files", () => {
    const journal = JSON.parse(readFileSync(journalPath, "utf-8"));
    const journalTags = new Set(journal.entries.map((e: any) => e.tag));
    const migrationsDir = join(__dirname, "../migrations");
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));

    for (const file of files) {
      const tag = file.replace(".sql", "");
      expect(journalTags.has(tag)).toBe(true);
    }
  });
});
