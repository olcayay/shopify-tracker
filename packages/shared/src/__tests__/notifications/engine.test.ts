import { describe, it, expect, vi } from "vitest";
import { emitNotification } from "../../notifications/engine.js";
import type { NotificationStore, NotificationRecipient } from "../../notifications/engine.js";

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

describe("emitNotification", () => {
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

  it("skips when type is globally disabled", async () => {
    const store = createMockStore({ isTypeEnabled: vi.fn().mockResolvedValue(false) });
    const result = await emitNotification(store, "ranking_top3_entry", {}, USERS);

    expect(result.sent).toBe(0);
    expect(store.save).not.toHaveBeenCalled();
  });

  it("skips users who opted out", async () => {
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

  it("skips duplicate notifications", async () => {
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

  it("rate limits when too many recent notifications", async () => {
    const store = createMockStore({
      countRecent: vi.fn().mockResolvedValue(50),
    });
    const result = await emitNotification(store, "ranking_top3_entry", {
      appName: "Test",
      keyword: "test",
    }, USERS);

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(2);
  });

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

  it("saves correct notification content", async () => {
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
});
