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
    for (const m of ["select", "from", "where", "limit", "orderBy"]) {
      chain[m] = () => chain;
    }
    chain.then = (resolve: any) => resolve(result);
    return chain;
  };

  return { select: chainable, __callIndex: () => callIndex };
}

const BASE_PARAMS = {
  emailType: "email_daily_digest",
  userId: "user-1",
  accountId: "account-1",
  recipientEmail: "user@test.com",
};

describe("checkEligibility", () => {
  it("returns eligible=true when all checks pass (no configs)", async () => {
    const db = createMockDb([
      [],  // 1. no global config → not disabled
      [],  // 2. no account override
      [],  // 3. no user pref
    ]);

    const result = await checkEligibility(db, BASE_PARAMS);
    expect(result.eligible).toBe(true);
  });

  it("returns eligible=false when email type is globally disabled", async () => {
    const db = createMockDb([
      [{ enabled: false, frequencyLimitHours: null }],  // disabled globally
    ]);

    const result = await checkEligibility(db, BASE_PARAMS);
    expect(result.eligible).toBe(false);
    expect(result.skipReason).toContain("globally disabled");
  });

  it("passes when email type is globally enabled", async () => {
    const db = createMockDb([
      [{ enabled: true, frequencyLimitHours: null }],
      [],  // no account override
      [],  // no user pref
    ]);

    const result = await checkEligibility(db, BASE_PARAMS);
    expect(result.eligible).toBe(true);
  });

  it("returns eligible=false when account has disabled this type", async () => {
    const db = createMockDb([
      [],  // global: no config (allowed)
      [{ enabled: false }],  // account override: disabled
    ]);

    const result = await checkEligibility(db, BASE_PARAMS);
    expect(result.eligible).toBe(false);
    expect(result.skipReason).toContain("disabled for account");
  });

  it("returns eligible=false when user opted out", async () => {
    const db = createMockDb([
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
      [],  // global: ok
      [],  // account: ok
      [],  // user pref: ok
      // no 4th call — dedup is skipped
    ]);

    const result = await checkEligibility(db, BASE_PARAMS);
    expect(result.eligible).toBe(true);
  });

  it("checks all 5 stages in order", async () => {
    // All pass
    const db = createMockDb([
      [{ enabled: true, frequencyLimitHours: 12 }],
      [{ enabled: true }],   // account override enabled
      [{ enabled: true }],   // user preference enabled
      [{ count: 0 }],        // no recent sends
      [{ count: 0 }],        // no dedup match
    ]);

    const result = await checkEligibility(db, {
      ...BASE_PARAMS,
      deduplicationKey: "some-key",
    });
    expect(result.eligible).toBe(true);
  });
});
