import { describe, it, expect } from "vitest";
import { featureFlags, accountFeatureFlags } from "../schema/feature-flags.js";

describe("feature flags schema", () => {
  it("featureFlags table has correct column names", () => {
    expect(featureFlags.id.name).toBe("id");
    expect(featureFlags.slug.name).toBe("slug");
    expect(featureFlags.name.name).toBe("name");
    expect(featureFlags.description.name).toBe("description");
    expect(featureFlags.isEnabled.name).toBe("is_enabled");
    expect(featureFlags.activatedAt.name).toBe("activated_at");
    expect(featureFlags.deactivatedAt.name).toBe("deactivated_at");
    expect(featureFlags.createdAt.name).toBe("created_at");
  });

  it("accountFeatureFlags table has correct column names", () => {
    expect(accountFeatureFlags.id.name).toBe("id");
    expect(accountFeatureFlags.accountId.name).toBe("account_id");
    expect(accountFeatureFlags.featureFlagId.name).toBe("feature_flag_id");
    expect(accountFeatureFlags.enabledAt.name).toBe("enabled_at");
  });

  it("featureFlags exports from @appranks/db index", async () => {
    const db = await import("../index.js");
    expect(db.featureFlags).toBeDefined();
    expect(db.accountFeatureFlags).toBeDefined();
  });

  it("migration file contains idempotent DDL", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const migrationPath = path.join(__dirname, "../../src/migrations/0120_feature_flags.sql");
    const sql = fs.readFileSync(migrationPath, "utf-8");

    expect(sql).toContain("IF NOT EXISTS");
    expect(sql).toContain("ON CONFLICT");
    expect(sql).toContain("market-research");
  });

  it("journal includes migration 0120", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const journalPath = path.join(__dirname, "../../src/migrations/meta/_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
    const entry = journal.entries.find((e: any) => e.idx === 120);

    expect(entry).toBeDefined();
    expect(entry.tag).toBe("0120_feature_flags");
    expect(entry.version).toBe("7");
    expect(entry.breakpoints).toBe(true);
  });
});
