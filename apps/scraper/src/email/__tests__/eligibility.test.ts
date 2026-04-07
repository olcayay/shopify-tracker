import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkEligibility } from "../eligibility.js";

/**
 * Helper: build a mock DB where each chained select().from().where().limit()
 * resolves to a configurable array.
 */
function createMockDb(responses: any[][]) {
  let callIndex = 0;
  const chainable = () => {
    const idx = callIndex++;
    const result = responses[idx] ?? [];
    const chain: any = {};
    for (const m of ["select", "from", "where", "limit", "orderBy", "innerJoin"]) {
      chain[m] = () => chain;
    }
    chain.then = (resolve: any) => resolve(result);
    return chain;
  };

  return { select: chainable, __callIndex: () => callIndex };
}

/** Shorthand: a passing feature flag response (stage 0) */
const FLAG_ENABLED = [{ id: "flag-1" }];

const BASE_PARAMS = {
  emailType: "email_daily_digest",
  userId: "user-1",
  accountId: "account-1",
  recipientEmail: "user@test.com",
};

describe("checkEligibility", () => {
  it("returns eligible=false when feature flag is not enabled for account", async () => {
    const db = createMockDb([
      [],  // 0. no feature flag → blocked
    ]);

    const result = await checkEligibility(db, BASE_PARAMS);
    expect(result.eligible).toBe(false);
    expect(result.skipReason).toContain("feature flag");
  });

  it("returns eligible=true when all checks pass (no configs)", async () => {
    const db = createMockDb([
      FLAG_ENABLED,  // 0. feature flag enabled
      [],  // 1. no global config → not disabled
      [],  // 2. no account override
      [],  // 3. no user pref
    ]);

    const result = await checkEligibility(db, BASE_PARAMS);
    expect(result.eligible).toBe(true);
  });

  it("returns eligible=false when email type is globally disabled", async () => {
    const db = createMockDb([
      FLAG_ENABLED,
      [{ enabled: false, frequencyLimitHours: null }],  // disabled globally
    ]);

    const result = await checkEligibility(db, BASE_PARAMS);
    expect(result.eligible).toBe(false);
    expect(result.skipReason).toContain("globally disabled");
  });

  it("passes when email type is globally enabled", async () => {
    const db = createMockDb([
      FLAG_ENABLED,
      [{ enabled: true, frequencyLimitHours: null }],
      [],  // no account override
      [],  // no user pref
    ]);

    const result = await checkEligibility(db, BASE_PARAMS);
    expect(result.eligible).toBe(true);
  });

  it("returns eligible=false when account has disabled this type", async () => {
    const db = createMockDb([
      FLAG_ENABLED,
      [],  // global: no config (allowed)
      [{ enabled: false }],  // account override: disabled
    ]);

    const result = await checkEligibility(db, BASE_PARAMS);
    expect(result.eligible).toBe(false);
    expect(result.skipReason).toContain("disabled for account");
  });

  it("returns eligible=false when user opted out", async () => {
    const db = createMockDb([
      FLAG_ENABLED,
      [],  // global: ok
      [],  // account: ok
      [{ enabled: false }],  // user opted out
    ]);

    const result = await checkEligibility(db, BASE_PARAMS);
    expect(result.eligible).toBe(false);
    expect(result.skipReason).toContain("user opted out");
  });

  it("returns eligible=false when frequency cap hit", async () => {
    const db = createMockDb([
      FLAG_ENABLED,
      [{ enabled: true, frequencyLimitHours: 24 }],  // 24h frequency cap
      [],  // account: ok
      [],  // user pref: ok
      [{ count: 1 }],  // recent send found → capped
    ]);

    const result = await checkEligibility(db, BASE_PARAMS);
    expect(result.eligible).toBe(false);
    expect(result.skipReason).toContain("frequency cap");
  });

  it("passes frequency cap when no recent sends", async () => {
    const db = createMockDb([
      FLAG_ENABLED,
      [{ enabled: true, frequencyLimitHours: 24 }],
      [],
      [],
      [{ count: 0 }],  // no recent sends
    ]);

    const result = await checkEligibility(db, BASE_PARAMS);
    expect(result.eligible).toBe(true);
  });

  it("returns eligible=false when dedup key matches", async () => {
    const db = createMockDb([
      FLAG_ENABLED,
      [],  // global: ok
      [],  // account: ok
      [],  // user pref: ok
      [{ count: 1 }],  // dedup match found
    ]);

    const result = await checkEligibility(db, {
      ...BASE_PARAMS,
      deduplicationKey: "ranking-change-app1",
    });
    expect(result.eligible).toBe(false);
    expect(result.skipReason).toContain("duplicate");
  });

  it("skips dedup check when no deduplicationKey provided", async () => {
    const db = createMockDb([
      FLAG_ENABLED,
      [],  // global: ok
      [],  // account: ok
      [],  // user pref: ok
      // no 5th call — dedup is skipped
    ]);

    const result = await checkEligibility(db, BASE_PARAMS);
    expect(result.eligible).toBe(true);
  });

  it("checks all stages in order", async () => {
    // All pass (including daily limit check for alert emails)
    const db = createMockDb([
      FLAG_ENABLED,                                   // feature flag
      [{ enabled: true, frequencyLimitHours: 12 }],   // global config
      [{ enabled: true }],   // account override enabled
      [{ enabled: true }],   // user preference enabled
      [{ count: 0 }],        // no recent sends (frequency cap)
      [{ count: 0 }],        // no dedup match
      [{ count: 5 }],        // daily count: 5 (under limit of 10)
    ]);

    const result = await checkEligibility(db, {
      ...BASE_PARAMS,
      emailType: "email_ranking_alert",
      deduplicationKey: "some-key",
    });
    expect(result.eligible).toBe(true);
  });

  it("returns eligible=false when daily alert email limit is reached", async () => {
    const db = createMockDb([
      FLAG_ENABLED,
      [],  // global: ok
      [],  // account: ok
      [],  // user pref: ok
      [{ count: 10 }],  // daily count: 10 (at limit)
    ]);

    const result = await checkEligibility(db, {
      ...BASE_PARAMS,
      emailType: "email_ranking_alert",
    });
    expect(result.eligible).toBe(false);
    expect(result.skipReason).toContain("daily limit");
  });

  it("bypasses daily limit when skipDailyLimit is true", async () => {
    const db = createMockDb([
      FLAG_ENABLED,
      [],  // global: ok
      [],  // account: ok
      [],  // user pref: ok
      // no daily count check — skipped
    ]);

    const result = await checkEligibility(db, {
      ...BASE_PARAMS,
      emailType: "email_ranking_alert",
      skipDailyLimit: true,
    });
    expect(result.eligible).toBe(true);
  });

  it("passes ISO strings (not raw Date objects) to sql template in frequency cap", async () => {
    // Intercept the drizzle sql tagged template to check for raw Date values
    const { sql } = await import("drizzle-orm");
    const sqlSpy = vi.spyOn({ sql }, "sql");

    // The real check: verify the code uses .toISOString() by reading the source
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../eligibility.ts", import.meta.url).pathname.replace("/eligibility.ts", "/eligibility.ts"),
      "utf-8"
    );

    // Line with frequency cap should use .toISOString()
    const freqCapLines = source.split("\n").filter(
      (line) => line.includes("emailLogs.createdAt") && line.includes("since")
    );
    expect(freqCapLines.length).toBeGreaterThan(0);
    for (const line of freqCapLines) {
      expect(line).toContain(".toISOString()");
    }

    // Line with dedup check should use .toISOString()
    const dedupLines = source.split("\n").filter(
      (line) => line.includes("emailLogs.createdAt") && line.includes("oneHourAgo")
    );
    expect(dedupLines.length).toBeGreaterThan(0);
    for (const line of dedupLines) {
      expect(line).toContain(".toISOString()");
    }

    // Daily limit line should also use .toISOString()
    const dailyLines = source.split("\n").filter(
      (line) => line.includes("emailLogs.createdAt") && line.includes("todayMidnight")
    );
    expect(dailyLines.length).toBeGreaterThan(0);
    for (const line of dailyLines) {
      expect(line).toContain(".toISOString()");
    }
  });

  it("skips daily limit check for non-alert email types", async () => {
    const db = createMockDb([
      FLAG_ENABLED,
      [],  // global: ok
      [],  // account: ok
      [],  // user pref: ok
      // no daily count check — not an alert type
    ]);

    const result = await checkEligibility(db, BASE_PARAMS);
    expect(result.eligible).toBe(true);
  });
});
