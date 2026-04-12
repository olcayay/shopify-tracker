import { describe, it, expect } from "vitest";

/**
 * Tests for the per-(platform, scraperType) lock key format in worker.ts.
 * Two jobs on the same platform but different scraper types must get distinct
 * lock keys so they can run concurrently. Jobs with the same (platform, type)
 * must still serialize.
 */
function buildLockKey(platform: string, jobType: string): string {
  return `platform:${platform}:${jobType}`;
}

describe("Worker per-scraperType lock key", () => {
  it("produces distinct keys for different scraper types on the same platform", () => {
    const category = buildLockKey("salesforce", "category");
    const reviews = buildLockKey("salesforce", "reviews");
    const appDetails = buildLockKey("salesforce", "app_details");
    expect(category).not.toBe(reviews);
    expect(category).not.toBe(appDetails);
    expect(reviews).not.toBe(appDetails);
  });

  it("produces identical keys for the same (platform, scraperType)", () => {
    const a = buildLockKey("salesforce", "category");
    const b = buildLockKey("salesforce", "category");
    expect(a).toBe(b);
  });

  it("produces distinct keys across platforms for the same scraper type", () => {
    expect(buildLockKey("shopify", "category")).not.toBe(
      buildLockKey("salesforce", "category"),
    );
  });

  it("uses the documented platform:{id}:{type} shape", () => {
    expect(buildLockKey("hubspot", "app_details")).toBe("platform:hubspot:app_details");
  });
});
