import { describe, it, expect, vi } from "vitest";
import { emitNotification } from "../../notifications/engine.js";
import type { NotificationStore, NotificationRecipient } from "../../notifications/engine.js";
import type { NotificationType } from "../../notification-types.js";

function createMockStore(overrides: Partial<NotificationStore> = {}): NotificationStore {
  return {
    findUsersTrackingApp: vi.fn().mockResolvedValue([]),
    findUsersTrackingKeyword: vi.fn().mockResolvedValue([]),
    isTypeEnabled: vi.fn().mockResolvedValue(true),
    isUserOptedIn: vi.fn().mockResolvedValue(true),
    isDuplicate: vi.fn().mockResolvedValue(false),
    countRecent: vi.fn().mockResolvedValue(0),
    save: vi.fn().mockResolvedValue("notif-1"),
    ...overrides,
  };
}

const USERS: NotificationRecipient[] = [
  { userId: "u1", accountId: "a1" },
  { userId: "u2", accountId: "a2" },
];

const THREE_USERS: NotificationRecipient[] = [
  { userId: "u1", accountId: "a1" },
  { userId: "u2", accountId: "a1" },
  { userId: "u3", accountId: "a2" },
];

describe("emitNotification", () => {
  // ─── Basic delivery ──────────────────────────────────────────────
  it("sends notifications to all recipients", async () => {
    const store = createMockStore();
    const result = await emitNotification(store, "ranking_top3_entry", {
      appName: "TestApp",
      keyword: "email marketing",
      position: 2,
    }, USERS);

    expect(result.sent).toBe(2);
    expect(result.skipped).toBe(0);
    expect(store.save).toHaveBeenCalledTimes(2);
  });

  it("returns zeros for unknown notification type", async () => {
    const store = createMockStore();
    const result = await emitNotification(
      store,
      "totally_bogus_type" as NotificationType,
      {},
      USERS,
    );

    expect(result).toEqual({ sent: 0, skipped: 0, errors: 0 });
    expect(store.save).not.toHaveBeenCalled();
  });

  it("returns zeros when recipient list is empty and no appId/keywordId", async () => {
    const store = createMockStore();
    const result = await emitNotification(store, "ranking_top3_entry", {
      appName: "Test",
    }, []);

    expect(result).toEqual({ sent: 0, skipped: 0, errors: 0 });
  });

  // ─── Deduplication ───────────────────────────────────────────────
  it("skips duplicate notifications (same type+app within dedup window)", async () => {
    const store = createMockStore({
      isDuplicate: vi.fn().mockResolvedValue(true),
    });
    const result = await emitNotification(store, "ranking_top3_entry", {
      appName: "Test",
      appSlug: "test",
      keyword: "test",
    }, USERS);

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(2);
  });

  it("delivers when isDuplicate returns false (after dedup window expired)", async () => {
    const store = createMockStore({
      isDuplicate: vi.fn().mockResolvedValue(false),
    });
    const result = await emitNotification(store, "ranking_top3_entry", {
      appName: "Test",
      appSlug: "test-app",
      keyword: "email",
      position: 1,
    }, [USERS[0]]);

    expect(result.sent).toBe(1);
    expect(store.isDuplicate).toHaveBeenCalledWith(
      "u1",
      "ranking_top3_entry",
      "ranking_top3_entry:test-app",
      6,
    );
  });

  it("delivers different notification types for same app within dedup window", async () => {
    // isDuplicate checks type+dedupKey, so different types should both be delivered
    const store = createMockStore({
      isDuplicate: vi.fn().mockResolvedValue(false),
    });
    const user = [USERS[0]];

    const r1 = await emitNotification(store, "ranking_top3_entry", {
      appName: "App", appSlug: "app", keyword: "kw", position: 1,
    }, user);
    const r2 = await emitNotification(store, "ranking_top3_exit", {
      appName: "App", appSlug: "app", keyword: "kw", position: 5,
    }, user);

    expect(r1.sent).toBe(1);
    expect(r2.sent).toBe(1);
  });

  it("passes 6 hours as dedup window to isDuplicate", async () => {
    const isDuplicate = vi.fn().mockResolvedValue(false);
    const store = createMockStore({ isDuplicate });
    await emitNotification(store, "review_new_positive", {
      appName: "A", appSlug: "a", rating: 5,
    }, [USERS[0]]);

    expect(isDuplicate).toHaveBeenCalledWith("u1", "review_new_positive", "review_new_positive:a", 6);
  });

  it("skips dedup check when dedupKey is null (no slug data)", async () => {
    const isDuplicate = vi.fn();
    const store = createMockStore({ isDuplicate });
    // No appSlug, competitorSlug, keywordSlug, or categorySlug => dedupKey is null
    const result = await emitNotification(store, "ranking_top3_entry", {
      appName: "Test",
      keyword: "test",
      position: 1,
    }, [USERS[0]]);

    expect(isDuplicate).not.toHaveBeenCalled();
    expect(result.sent).toBe(1);
  });

  it("builds dedup key from multiple slug fields", async () => {
    const isDuplicate = vi.fn().mockResolvedValue(false);
    const store = createMockStore({ isDuplicate });
    await emitNotification(store, "competitor_overtook", {
      appName: "MyApp",
      appSlug: "my-app",
      competitorName: "Rival",
      competitorSlug: "rival",
      keyword: "crm",
      keywordSlug: "crm",
    }, [USERS[0]]);

    // dedupKey should include type + appSlug + competitorSlug + keywordSlug
    expect(isDuplicate).toHaveBeenCalledWith(
      "u1",
      "competitor_overtook",
      "competitor_overtook:my-app:rival:crm",
      6,
    );
  });

  // ─── Rate Limiting ───────────────────────────────────────────────
  it("delivers the 50th notification in an hour (at limit boundary)", async () => {
    const store = createMockStore({
      countRecent: vi.fn().mockResolvedValue(49),
    });
    const result = await emitNotification(store, "ranking_top3_entry", {
      appName: "Test", keyword: "test", position: 1,
    }, [USERS[0]]);

    expect(result.sent).toBe(1);
  });

  it("skips the 51st notification in an hour (over limit)", async () => {
    const store = createMockStore({
      countRecent: vi.fn().mockResolvedValue(50),
    });
    const result = await emitNotification(store, "ranking_top3_entry", {
      appName: "Test", keyword: "test", position: 1,
    }, USERS);

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(2);
  });

  it("delivers after rate limit resets (countRecent returns low number)", async () => {
    const countRecent = vi.fn()
      .mockResolvedValueOnce(50) // first user: rate limited
      .mockResolvedValueOnce(5); // second user: fine
    const store = createMockStore({ countRecent });

    const result = await emitNotification(store, "ranking_top3_entry", {
      appName: "Test", keyword: "test", position: 1,
    }, USERS);

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it("passes 1 hour window to countRecent", async () => {
    const countRecent = vi.fn().mockResolvedValue(0);
    const store = createMockStore({ countRecent });
    await emitNotification(store, "ranking_top3_entry", {
      appName: "Test", keyword: "test", position: 1,
    }, [USERS[0]]);

    expect(countRecent).toHaveBeenCalledWith("u1", 1);
  });

  // ─── User Preferences ────────────────────────────────────────────
  it("skips when type is globally disabled", async () => {
    const store = createMockStore({ isTypeEnabled: vi.fn().mockResolvedValue(false) });
    const result = await emitNotification(store, "ranking_top3_entry", {}, USERS);

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(0); // globally disabled returns early, not per-user skip
    expect(store.save).not.toHaveBeenCalled();
  });

  it("skips users who opted out of a specific type", async () => {
    const store = createMockStore({
      isUserOptedIn: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
    });
    const result = await emitNotification(store, "ranking_top3_entry", {
      appName: "Test",
      keyword: "test",
    }, USERS);

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it("skips all users when global disabled even if users opted in", async () => {
    const store = createMockStore({
      isTypeEnabled: vi.fn().mockResolvedValue(false),
      isUserOptedIn: vi.fn().mockResolvedValue(true), // would be true, but global wins
    });
    const result = await emitNotification(store, "system_scrape_complete", {
      scraperType: "app_details", platform: "shopify",
    }, USERS);

    expect(result.sent).toBe(0);
    // isUserOptedIn should never even be called when global is off
    expect(store.isUserOptedIn).not.toHaveBeenCalled();
  });

  it("checks user preference per user independently", async () => {
    const isUserOptedIn = vi.fn()
      .mockResolvedValueOnce(false) // u1 opted out
      .mockResolvedValueOnce(true)  // u2 opted in
      .mockResolvedValueOnce(true); // u3 opted in
    const store = createMockStore({ isUserOptedIn });

    const result = await emitNotification(store, "review_new_negative", {
      appName: "Test", rating: 2, appSlug: "test",
    }, THREE_USERS);

    expect(result.sent).toBe(2);
    expect(result.skipped).toBe(1);
    expect(isUserOptedIn).toHaveBeenCalledWith("u1", "review_new_negative");
    expect(isUserOptedIn).toHaveBeenCalledWith("u2", "review_new_negative");
    expect(isUserOptedIn).toHaveBeenCalledWith("u3", "review_new_negative");
  });

  // ─── Recipient Resolution ────────────────────────────────────────
  it("finds users by appId when no recipients provided", async () => {
    const store = createMockStore({
      findUsersTrackingApp: vi.fn().mockResolvedValue([USERS[0]]),
    });
    const result = await emitNotification(store, "review_new_positive", {
      appName: "Test",
      appId: 42,
      rating: 5,
    });

    expect(store.findUsersTrackingApp).toHaveBeenCalledWith(42);
    expect(result.sent).toBe(1);
  });

  it("finds users by keywordId when no appId and no recipients", async () => {
    const store = createMockStore({
      findUsersTrackingKeyword: vi.fn().mockResolvedValue([USERS[1]]),
    });
    const result = await emitNotification(store, "keyword_position_gained", {
      appName: "Test",
      keywordId: 99,
      keyword: "seo",
      keywordSlug: "seo",
      position: 3,
      previousPosition: 8,
      change: 5,
    });

    expect(store.findUsersTrackingKeyword).toHaveBeenCalledWith(99);
    expect(result.sent).toBe(1);
  });

  it("uses custom recipients when provided instead of resolving", async () => {
    const findUsersTrackingApp = vi.fn();
    const store = createMockStore({ findUsersTrackingApp });
    const customRecipients = [{ userId: "custom-user", accountId: "custom-account" }];

    const result = await emitNotification(store, "account_member_joined", {
      memberName: "Jane",
      memberEmail: "jane@test.com",
    }, customRecipients);

    expect(findUsersTrackingApp).not.toHaveBeenCalled();
    expect(result.sent).toBe(1);
    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "custom-user",
        accountId: "custom-account",
      }),
    );
  });

  it("sends to all users in account-wide notification", async () => {
    const accountUsers = [
      { userId: "u1", accountId: "team-a" },
      { userId: "u2", accountId: "team-a" },
      { userId: "u3", accountId: "team-a" },
    ];
    const store = createMockStore();
    const result = await emitNotification(store, "account_limit_warning", {
      limitType: "tracked apps",
      current: 45,
      max: 50,
    }, accountUsers);

    expect(result.sent).toBe(3);
    expect(store.save).toHaveBeenCalledTimes(3);
    for (const call of (store.save as any).mock.calls) {
      expect(call[0].accountId).toBe("team-a");
    }
  });

  it("tries appId first, then keywordId for recipient resolution", async () => {
    const findUsersTrackingApp = vi.fn().mockResolvedValue([USERS[0]]);
    const findUsersTrackingKeyword = vi.fn().mockResolvedValue([USERS[1]]);
    const store = createMockStore({ findUsersTrackingApp, findUsersTrackingKeyword });

    // With both appId and keywordId, should use appId since it finds users
    await emitNotification(store, "keyword_position_gained", {
      appName: "Test", appId: 1, keywordId: 2, keyword: "seo", position: 3,
    });

    expect(findUsersTrackingApp).toHaveBeenCalledWith(1);
    // keywordId should NOT be called because appId already returned users
    expect(findUsersTrackingKeyword).not.toHaveBeenCalled();
  });

  it("falls back to keywordId when appId returns no users", async () => {
    const findUsersTrackingApp = vi.fn().mockResolvedValue([]);
    const findUsersTrackingKeyword = vi.fn().mockResolvedValue([USERS[0]]);
    const store = createMockStore({ findUsersTrackingApp, findUsersTrackingKeyword });

    const result = await emitNotification(store, "keyword_new_ranking", {
      appName: "Test", appId: 1, keywordId: 2, keyword: "seo", position: 5,
    });

    expect(findUsersTrackingApp).toHaveBeenCalled();
    expect(findUsersTrackingKeyword).toHaveBeenCalledWith(2);
    expect(result.sent).toBe(1);
  });

  // ─── Saved Record Content ────────────────────────────────────────
  it("saves correct notification content for ranking type", async () => {
    const store = createMockStore();
    await emitNotification(store, "ranking_top3_entry", {
      appName: "Klaviyo",
      keyword: "email marketing",
      position: 1,
      categoryName: "Marketing",
    }, [USERS[0]]);

    expect(store.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: "u1",
      accountId: "a1",
      type: "ranking_top3_entry",
      category: "ranking",
      priority: "high",
    }));
    const savedRecord = (store.save as any).mock.calls[0][0];
    expect(savedRecord.title).toContain("Klaviyo");
    expect(savedRecord.title).toContain("Top 3");
  });

  it("saves correct category for each notification type group", async () => {
    const cases: [NotificationType, string, Record<string, unknown>][] = [
      ["ranking_significant_change", "ranking", { appName: "A", keyword: "k", position: 1, change: 5 }],
      ["competitor_overtook", "competitor", { appName: "A", competitorName: "B", keyword: "k", position: 1 }],
      ["review_new_positive", "review", { appName: "A", rating: 5 }],
      ["keyword_position_gained", "keyword", { appName: "A", keyword: "k", position: 1, previousPosition: 5, change: 4 }],
      ["featured_new_placement", "featured", { appName: "A" }],
      ["system_scrape_complete", "system", { scraperType: "apps", platform: "shopify" }],
      ["account_member_joined", "account", { memberName: "Bob" }],
    ];

    for (const [type, expectedCategory, data] of cases) {
      const store = createMockStore();
      await emitNotification(store, type, data, [USERS[0]]);
      const record = (store.save as any).mock.calls[0][0];
      expect(record.category).toBe(expectedCategory);
    }
  });

  it("preserves eventData in saved record", async () => {
    const store = createMockStore();
    const eventData = {
      appName: "TestApp",
      appSlug: "test-app",
      platform: "shopify",
      keyword: "marketing",
      position: 5,
    };
    await emitNotification(store, "ranking_top3_entry", eventData, [USERS[0]]);

    const record = (store.save as any).mock.calls[0][0];
    expect(record.eventData).toEqual(eventData);
  });

  // ─── Error Handling ──────────────────────────────────────────────
  it("counts errors without throwing", async () => {
    const store = createMockStore({
      save: vi.fn().mockRejectedValue(new Error("DB error")),
    });
    const result = await emitNotification(store, "ranking_top3_entry", {
      appName: "Test",
      keyword: "test",
    }, USERS);

    expect(result.errors).toBe(2);
    expect(result.sent).toBe(0);
  });

  it("continues processing remaining users after one fails", async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(new Error("DB error")) // u1 fails
      .mockResolvedValueOnce("notif-2");             // u2 succeeds
    const store = createMockStore({ save });

    const result = await emitNotification(store, "ranking_top3_entry", {
      appName: "Test", keyword: "test", position: 1,
    }, USERS);

    expect(result.errors).toBe(1);
    expect(result.sent).toBe(1);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("handles store.isTypeEnabled throwing gracefully", async () => {
    // This returns a rejected promise, which should cause the function to throw
    // since isTypeEnabled is called before the try/catch per-user loop
    const store = createMockStore({
      isTypeEnabled: vi.fn().mockRejectedValue(new Error("DB down")),
    });

    await expect(
      emitNotification(store, "ranking_top3_entry", { appName: "Test" }, USERS),
    ).rejects.toThrow("DB down");
  });

  // ─── Edge Cases ──────────────────────────────────────────────────
  it("handles single user recipient", async () => {
    const store = createMockStore();
    const result = await emitNotification(store, "featured_new_placement", {
      appName: "MyApp",
      appSlug: "my-app",
      platform: "shopify",
      surfaceName: "Staff Picks",
    }, [USERS[0]]);

    expect(result.sent).toBe(1);
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it("evaluates each check in order: preference -> dedup -> rate limit", async () => {
    const callOrder: string[] = [];
    const store = createMockStore({
      isUserOptedIn: vi.fn().mockImplementation(async () => {
        callOrder.push("optedIn");
        return true;
      }),
      isDuplicate: vi.fn().mockImplementation(async () => {
        callOrder.push("dedup");
        return false;
      }),
      countRecent: vi.fn().mockImplementation(async () => {
        callOrder.push("rateLimit");
        return 0;
      }),
    });

    await emitNotification(store, "ranking_top3_entry", {
      appName: "Test", appSlug: "test", keyword: "k", position: 1,
    }, [USERS[0]]);

    expect(callOrder).toEqual(["optedIn", "dedup", "rateLimit"]);
  });

  it("does not check dedup or rate limit if user opted out", async () => {
    const isDuplicate = vi.fn();
    const countRecent = vi.fn();
    const store = createMockStore({
      isUserOptedIn: vi.fn().mockResolvedValue(false),
      isDuplicate,
      countRecent,
    });

    await emitNotification(store, "ranking_top3_entry", {
      appName: "Test", appSlug: "test", keyword: "k", position: 1,
    }, [USERS[0]]);

    expect(isDuplicate).not.toHaveBeenCalled();
    expect(countRecent).not.toHaveBeenCalled();
  });

  it("does not check rate limit if notification is duplicate", async () => {
    const countRecent = vi.fn();
    const store = createMockStore({
      isDuplicate: vi.fn().mockResolvedValue(true),
      countRecent,
    });

    await emitNotification(store, "ranking_top3_entry", {
      appName: "Test", appSlug: "test", keyword: "k", position: 1,
    }, [USERS[0]]);

    expect(countRecent).not.toHaveBeenCalled();
  });

  it("correctly combines sent/skipped/errors across mixed outcomes", async () => {
    const users = [
      { userId: "u1", accountId: "a1" },
      { userId: "u2", accountId: "a1" },
      { userId: "u3", accountId: "a1" },
      { userId: "u4", accountId: "a1" },
    ];

    const isUserOptedIn = vi.fn()
      .mockResolvedValueOnce(true)  // u1: proceeds
      .mockResolvedValueOnce(false) // u2: skipped (opted out)
      .mockResolvedValueOnce(true)  // u3: proceeds
      .mockResolvedValueOnce(true); // u4: proceeds

    const isDuplicate = vi.fn()
      .mockResolvedValueOnce(true)  // u1: skipped (duplicate)
      .mockResolvedValueOnce(false) // u3: proceeds
      .mockResolvedValueOnce(false); // u4: proceeds

    const countRecent = vi.fn()
      .mockResolvedValueOnce(0)   // u3: proceeds
      .mockResolvedValueOnce(50); // u4: skipped (rate limited)

    const save = vi.fn()
      .mockResolvedValueOnce("notif-1"); // u3: sent

    const store = createMockStore({
      isUserOptedIn,
      isDuplicate,
      countRecent,
      save,
    });

    const result = await emitNotification(store, "review_new_negative", {
      appName: "Test", appSlug: "test", rating: 1,
    }, users);

    expect(result.sent).toBe(1);    // u3
    expect(result.skipped).toBe(3); // u2 (opted out) + u1 (dup) + u4 (rate limited)
    expect(result.errors).toBe(0);
  });
});
