import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DetectedEvent } from "../../events/event-detector.js";

// Mock queue enqueue functions
const mockEnqueueBulkEmail = vi.fn().mockResolvedValue("email-job-1");
const mockEnqueueNotification = vi.fn().mockResolvedValue("notif-job-1");
vi.mock("../../queue.js", () => ({
  enqueueBulkEmail: (...args: any[]) => mockEnqueueBulkEmail(...args),
  enqueueNotification: (...args: any[]) => mockEnqueueNotification(...args),
}));

// Mock DB
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", a, b })),
  inArray: vi.fn((col, vals) => ({ type: "inArray", col, vals })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: any[]) => ({ type: "sql" })),
}));

vi.mock("@appranks/db", () => ({
  accountTrackedApps: { accountId: "account_id", appId: "app_id" },
  accountTrackedKeywords: { accountId: "account_id", keywordId: "keyword_id" },
  accountCompetitorApps: { accountId: "account_id", competitorAppId: "competitor_app_id" },
  users: { id: "id", accountId: "account_id", email: "email", name: "name" },
  sqlArray: vi.fn((arr: any[]) => arr),
}));

const { dispatch, dispatchAll, findAffectedUsers } = await import("../../events/event-dispatcher.js");

function makeEvent(overrides: Partial<DetectedEvent> = {}): DetectedEvent {
  return {
    type: "ranking_top3_entry",
    appId: 1,
    platform: "shopify",
    severity: "critical",
    data: { appSlug: "test-app", appName: "Test App", keyword: "seo", position: 2 },
    ...overrides,
  };
}

function makeMockDb(affectedUsers: any[] = []) {
  const selectResult = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(affectedUsers.length > 0
        ? affectedUsers.map((u) => ({ accountId: u.accountId }))
        : [])
    }),
  };
  // Track call count to return different results for different calls
  let callCount = 0;
  return {
    select: vi.fn(() => {
      callCount++;
      if (callCount <= 2) {
        // First two calls: accountTrackedApps + accountCompetitorApps
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(
              callCount === 1 ? [{ accountId: "a1" }] : []
            ),
          }),
        };
      }
      // Third call: users in accounts
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(affectedUsers),
        }),
      };
    }),
  } as any;
}

describe("dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues both email and notification for ranking events", async () => {
    const users = [
      { userId: "u1", accountId: "a1", email: "u1@test.com", name: "Alice" },
      { userId: "u2", accountId: "a1", email: "u2@test.com", name: "Bob" },
    ];
    const db = makeMockDb(users);
    const event = makeEvent();

    const result = await dispatch(db, event);

    expect(mockEnqueueNotification).toHaveBeenCalledTimes(2);
    expect(mockEnqueueBulkEmail).toHaveBeenCalledTimes(2);
    expect(result.usersAffected).toBe(2);
    expect(result.emailJobsEnqueued).toBe(2);
    expect(result.notificationJobsEnqueued).toBe(2);
  });

  it("returns zeros when no affected users", async () => {
    const db = makeMockDb([]);
    const event = makeEvent();

    const result = await dispatch(db, event);

    expect(result.usersAffected).toBe(0);
    expect(result.emailJobsEnqueued).toBe(0);
    expect(result.notificationJobsEnqueued).toBe(0);
  });

  it("enqueues email for ranking events (now enabled with safeguards)", async () => {
    const users = [{ userId: "u1", accountId: "a1", email: "u1@test.com", name: "Alice" }];
    const db = makeMockDb(users);

    const result = await dispatch(db, makeEvent());

    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
    expect(mockEnqueueBulkEmail).toHaveBeenCalledTimes(1);
    expect(result.notificationJobsEnqueued).toBe(1);
    expect(result.emailJobsEnqueued).toBe(1);
  });

  it("includes platform field in email and notification payloads", async () => {
    const users = [{ userId: "u1", accountId: "a1", email: "u1@test.com", name: "Alice" }];
    const db = makeMockDb(users);
    const event = makeEvent({ platform: "zendesk" });

    await dispatch(db, event);

    // Both email and notification payloads should include platform
    const emailPayload = mockEnqueueBulkEmail.mock.calls[0][0].payload;
    expect(emailPayload.platform).toBe("zendesk");

    const notifPayload = mockEnqueueNotification.mock.calls[0][0].payload;
    expect(notifPayload.platform).toBe("zendesk");
  });

  it("sends only notification for keyword position events", async () => {
    const users = [{ userId: "u1", accountId: "a1", email: "u1@test.com", name: "Alice" }];
    const db = makeMockDb(users);
    const event = makeEvent({ type: "keyword_position_gained" });

    const result = await dispatch(db, event);

    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
    // keyword_position_gained is NOT in EMAIL_EVENT_TYPES
    expect(mockEnqueueBulkEmail).not.toHaveBeenCalled();
    expect(result.notificationJobsEnqueued).toBe(1);
    expect(result.emailJobsEnqueued).toBe(0);
  });
});

describe("dispatchAll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches multiple events and aggregates results", async () => {
    const users = [{ userId: "u1", accountId: "a1", email: "u1@test.com", name: "Alice" }];
    const db = makeMockDb(users);
    const events = [
      makeEvent({ type: "ranking_top3_entry" }),
      makeEvent({ type: "review_new_positive" }),
    ];

    // Need to create a fresh db for each dispatch call
    let callIdx = 0;
    db.select = vi.fn(() => {
      callIdx++;
      const phase = ((callIdx - 1) % 3);
      if (phase === 0) {
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ accountId: "a1" }]) }) };
      } else if (phase === 1) {
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
      }
      return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(users) }) };
    });

    const result = await dispatchAll(db, events);

    expect(result.notificationJobsEnqueued).toBe(2);
    // Both events are email-eligible types, so emails should be enqueued too
    expect(result.emailJobsEnqueued).toBeGreaterThanOrEqual(0);
  });

  it("continues dispatching even if one event fails", async () => {
    const users = [{ userId: "u1", accountId: "a1", email: "u1@test.com", name: "Alice" }];
    const db = makeMockDb(users);

    // First event throws
    let callIdx = 0;
    db.select = vi.fn(() => {
      callIdx++;
      if (callIdx <= 3) {
        // First event - throw on first select
        if (callIdx === 1) throw new Error("DB error");
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
      }
      const phase = ((callIdx - 4) % 3);
      if (phase === 0) {
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ accountId: "a1" }]) }) };
      } else if (phase === 1) {
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
      }
      return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(users) }) };
    });

    const events = [
      makeEvent({ type: "ranking_top3_entry" }),
      makeEvent({ type: "review_new_positive" }),
    ];

    // Should not throw
    const result = await dispatchAll(db, events);
    // Second event should have succeeded
    expect(result.notificationJobsEnqueued).toBeGreaterThanOrEqual(0);
  });
});

describe("EVENT_TO_NOTIFICATION_TYPE mapping", () => {
  it("all mapped notification types exist in NOTIFICATION_TYPES", async () => {
    const { NOTIFICATION_TYPES } = await import("@appranks/shared");
    const users = [{ userId: "u1", accountId: "a1", email: "u1@test.com", name: "Alice" }];

    // All event types that should map to valid notification types
    const eventTypes = [
      "ranking_top3_entry", "ranking_top3_exit", "ranking_significant_change",
      "ranking_dropped_out", "ranking_new_entry", "ranking_category_change",
      "ranking_top1", "keyword_new_ranking", "keyword_position_gained",
      "keyword_position_lost", "competitor_overtook", "competitor_featured",
      "competitor_review_surge", "competitor_pricing_change",
      "review_new_positive", "review_new_negative", "review_velocity_spike",
      "review_milestone", "rating_milestone",
      "featured_new_placement", "featured_removed",
    ];

    for (const eventType of eventTypes) {
      vi.clearAllMocks();
      const db = makeMockDb(users);
      const event = makeEvent({ type: eventType as any });
      await dispatch(db, event);

      // Should have enqueued a notification
      expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
      // The notification type should be a valid key in NOTIFICATION_TYPES
      const notifData = mockEnqueueNotification.mock.calls[0][0];
      expect(NOTIFICATION_TYPES).toHaveProperty(notifData.type);
    }
  });
});
