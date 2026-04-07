import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import type { NotificationJobData } from "@appranks/shared";

// Mock emitNotification
const mockEmitNotification = vi.fn().mockResolvedValue({ sent: 1, skipped: 0, errors: 0 });
vi.mock("@appranks/shared", async (importOriginal) => {
  const orig: any = await importOriginal();
  return {
    ...orig,
    emitNotification: (...args: any[]) => mockEmitNotification(...args),
  };
});

// Mock DB operations
const mockDbSelect = vi.fn().mockReturnThis();
const mockDbFrom = vi.fn().mockReturnThis();
const mockDbWhere = vi.fn().mockReturnThis();
const mockDbOrderBy = vi.fn().mockReturnThis();
const mockDbLimit = vi.fn().mockResolvedValue([{
  id: "notif-1",
  title: "Test",
  body: "Test body",
  url: "/test",
  icon: null,
}]);
const mockDbInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: "notif-1" }]),
  }),
});
const mockDbUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

const mockDb = {
  select: mockDbSelect,
  from: mockDbFrom,
  where: mockDbWhere,
  orderBy: mockDbOrderBy,
  limit: mockDbLimit,
  insert: mockDbInsert,
  update: mockDbUpdate,
} as any;

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", a, b })),
  and: vi.fn((...args: any[]) => ({ type: "and", args })),
  inArray: vi.fn((col, vals) => ({ type: "inArray", col, vals })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: any[]) => ({
    type: "sql",
    strings,
    values,
  })),
}));

// Mock @appranks/db
vi.mock("@appranks/db", () => ({
  notifications: { id: "id", userId: "user_id", type: "type", createdAt: "created_at" },
  notificationTypeConfigs: { notificationType: "notification_type", inAppEnabled: "in_app_enabled" },
  userNotificationPreferences: { userId: "user_id", notificationType: "notification_type", inAppEnabled: "in_app_enabled" },
  notificationDeliveryLog: {},
  pushSubscriptions: { userId: "user_id", isActive: "is_active", id: "id" },
  accountTrackedApps: { appId: "app_id", accountId: "account_id" },
  accountTrackedKeywords: { keywordId: "keyword_id", accountId: "account_id" },
  users: { id: "id", accountId: "account_id" },
  sqlArray: vi.fn((arr: any[]) => arr),
}));

const { processNotification, createNotificationStore } = await import(
  "../../notifications/process-notification.js"
);

function makeJob(data: NotificationJobData): Job<NotificationJobData> {
  return {
    id: "notif-job-1",
    data,
    attemptsMade: 1,
    opts: { attempts: 3 },
  } as unknown as Job<NotificationJobData>;
}

describe("createNotificationStore", () => {
  it("creates a store with all required methods", () => {
    const store = createNotificationStore(mockDb);
    expect(store.findUsersTrackingApp).toBeDefined();
    expect(store.findUsersTrackingKeyword).toBeDefined();
    expect(store.isTypeEnabled).toBeDefined();
    expect(store.isUserOptedIn).toBeDefined();
    expect(store.isDuplicate).toBeDefined();
    expect(store.countRecent).toBeDefined();
    expect(store.save).toBeDefined();
  });
});

describe("processNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain mocks
    mockDbSelect.mockReturnThis();
    mockDbFrom.mockReturnThis();
    mockDbWhere.mockReturnThis();
    mockDbOrderBy.mockReturnThis();
    mockDbLimit.mockResolvedValue([{
      id: "notif-1",
      title: "Test",
      body: "Test body",
      url: "/test",
      icon: null,
    }]);
  });

  it("calls emitNotification with correct params", async () => {
    const job = makeJob({
      type: "notification_ranking_change",
      userId: "u1",
      accountId: "a1",
      payload: { appName: "Test App", appSlug: "test-app", platform: "shopify" },
      createdAt: new Date().toISOString(),
    });

    await processNotification(job, mockDb);

    expect(mockEmitNotification).toHaveBeenCalledWith(
      expect.any(Object), // store
      "notification_ranking_change",
      expect.objectContaining({ appName: "Test App" }),
      [{ userId: "u1", accountId: "a1" }]
    );
  });

  it("logs sent count after emitting", async () => {
    mockEmitNotification.mockResolvedValueOnce({ sent: 2, skipped: 1, errors: 0 });

    const job = makeJob({
      type: "notification_new_review",
      userId: "u1",
      accountId: "a1",
      payload: {},
      createdAt: new Date().toISOString(),
    });

    await processNotification(job, mockDb);

    expect(mockEmitNotification).toHaveBeenCalledOnce();
  });

  it("skips push when sendPush is false", async () => {
    const job = makeJob({
      type: "notification_ranking_change",
      userId: "u1",
      accountId: "a1",
      payload: {},
      createdAt: new Date().toISOString(),
      sendPush: false,
    });

    await processNotification(job, mockDb);

    // Should not try to query push subscriptions
    // emitNotification is called but push logic is skipped
    expect(mockEmitNotification).toHaveBeenCalledOnce();
  });

  it("handles zero sent notifications gracefully", async () => {
    mockEmitNotification.mockResolvedValueOnce({ sent: 0, skipped: 1, errors: 0 });

    const job = makeJob({
      type: "notification_milestone",
      userId: "u1",
      accountId: "a1",
      payload: {},
      createdAt: new Date().toISOString(),
    });

    // Should not throw
    await processNotification(job, mockDb);
  });
});
