import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockAdd = vi.fn().mockResolvedValue({ id: "test-job-id" });
const mockClose = vi.fn().mockResolvedValue(undefined);

vi.mock("bullmq", () => {
  const MockQueue = vi.fn(function (this: any) {
    this.add = mockAdd;
    this.close = mockClose;
  });
  return { Queue: MockQueue };
});

const {
  EMAIL_INSTANT_QUEUE_NAME,
  EMAIL_BULK_QUEUE_NAME,
  NOTIFICATIONS_QUEUE_NAME,
  enqueueInstantEmail,
  enqueueBulkEmail,
  enqueueNotification,
  getEmailInstantQueue,
  getEmailBulkQueue,
  getNotificationsQueue,
  closeAllQueues,
} = await import("../queue.js");

describe("queue constants", () => {
  it("defines email-instant queue name", () => {
    expect(EMAIL_INSTANT_QUEUE_NAME).toBe("email-instant");
  });

  it("defines email-bulk queue name", () => {
    expect(EMAIL_BULK_QUEUE_NAME).toBe("email-bulk");
  });

  it("defines notifications queue name", () => {
    expect(NOTIFICATIONS_QUEUE_NAME).toBe("notifications");
  });
});

describe("lazy queue initialization", () => {
  it("returns same instance on repeated calls", () => {
    const q1 = getEmailInstantQueue();
    const q2 = getEmailInstantQueue();
    expect(q1).toBe(q2);
  });

  it("returns same instance for email-bulk queue", () => {
    const q1 = getEmailBulkQueue();
    const q2 = getEmailBulkQueue();
    expect(q1).toBe(q2);
  });

  it("returns same instance for notifications queue", () => {
    const q1 = getNotificationsQueue();
    const q2 = getNotificationsQueue();
    expect(q1).toBe(q2);
  });
});

describe("enqueueInstantEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues an instant email job and returns job ID", async () => {
    const data = {
      type: "email_password_reset" as const,
      to: "user@example.com",
      name: "Test User",
      payload: { token: "abc123", resetUrl: "https://example.com/reset" },
      createdAt: new Date().toISOString(),
    };

    const jobId = await enqueueInstantEmail(data);

    expect(jobId).toBe("test-job-id");
    expect(mockAdd).toHaveBeenCalledWith(
      "email:email_password_reset",
      data,
      { priority: undefined }
    );
  });

  it("passes priority option", async () => {
    const data = {
      type: "email_2fa_code" as const,
      to: "user@example.com",
      payload: { code: "123456" },
      createdAt: new Date().toISOString(),
    };

    await enqueueInstantEmail(data, { priority: 1 });

    expect(mockAdd).toHaveBeenCalledWith(
      "email:email_2fa_code",
      data,
      { priority: 1 }
    );
  });
});

describe("enqueueBulkEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues a bulk email job and returns job ID", async () => {
    const data = {
      type: "email_daily_digest" as const,
      to: "user@example.com",
      name: "Test User",
      userId: "user-1",
      accountId: "account-1",
      payload: { apps: [] },
      createdAt: new Date().toISOString(),
    };

    const jobId = await enqueueBulkEmail(data);

    expect(jobId).toBe("test-job-id");
    expect(mockAdd).toHaveBeenCalledWith(
      "email:email_daily_digest",
      data,
      { priority: undefined, delay: undefined }
    );
  });

  it("passes delay option for scheduled emails", async () => {
    const data = {
      type: "email_onboarding" as const,
      to: "user@example.com",
      name: "New User",
      userId: "user-1",
      accountId: "account-1",
      payload: { step: 1 },
      createdAt: new Date().toISOString(),
    };

    await enqueueBulkEmail(data, { delay: 86400000 });

    expect(mockAdd).toHaveBeenCalledWith(
      "email:email_onboarding",
      data,
      { priority: undefined, delay: 86400000 }
    );
  });
});

describe("enqueueNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues a notification job and returns job ID", async () => {
    const data = {
      type: "notification_ranking_change" as const,
      userId: "user-1",
      accountId: "account-1",
      payload: { appSlug: "test-app", oldRank: 5, newRank: 3 },
      createdAt: new Date().toISOString(),
    };

    const jobId = await enqueueNotification(data);

    expect(jobId).toBe("test-job-id");
    expect(mockAdd).toHaveBeenCalledWith(
      "notification:notification_ranking_change",
      data,
      { priority: undefined, delay: undefined }
    );
  });
});

describe("closeAllQueues", () => {
  it("closes all initialized queues", async () => {
    // Ensure queues are initialized
    getEmailInstantQueue();
    getEmailBulkQueue();
    getNotificationsQueue();

    await closeAllQueues();

    // mockClose is called for all queue instances
    expect(mockClose).toHaveBeenCalled();
  });
});
