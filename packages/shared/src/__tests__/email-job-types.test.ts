import { describe, it, expect } from "vitest";
import type {
  InstantEmailJobType,
  InstantEmailJobData,
  BulkEmailJobType,
  BulkEmailJobData,
  NotificationJobType,
  NotificationJobData,
} from "../index.js";

describe("email job types", () => {
  it("InstantEmailJobData satisfies the type", () => {
    const job: InstantEmailJobData = {
      type: "email_password_reset",
      to: "user@example.com",
      name: "Test",
      payload: { token: "abc" },
      createdAt: new Date().toISOString(),
    };
    expect(job.type).toBe("email_password_reset");
    expect(job.to).toBe("user@example.com");
  });

  it("all instant email job types are valid", () => {
    const types: InstantEmailJobType[] = [
      "email_password_reset",
      "email_verification",
      "email_welcome",
      "email_invitation",
      "email_login_alert",
      "email_2fa_code",
    ];
    expect(types).toHaveLength(6);
  });

  it("BulkEmailJobData satisfies the type", () => {
    const job: BulkEmailJobData = {
      type: "email_daily_digest",
      to: "user@example.com",
      name: "Test",
      userId: "u1",
      accountId: "a1",
      payload: {},
      createdAt: new Date().toISOString(),
    };
    expect(job.type).toBe("email_daily_digest");
    expect(job.userId).toBe("u1");
  });

  it("all bulk email job types are valid", () => {
    const types: BulkEmailJobType[] = [
      "email_daily_digest",
      "email_weekly_summary",
      "email_ranking_alert",
      "email_competitor_alert",
      "email_review_alert",
      "email_win_celebration",
      "email_re_engagement",
      "email_onboarding",
    ];
    expect(types).toHaveLength(8);
  });
});

describe("notification job types", () => {
  it("NotificationJobData satisfies the type", () => {
    const job: NotificationJobData = {
      type: "notification_ranking_change",
      userId: "u1",
      accountId: "a1",
      payload: { appSlug: "test" },
      createdAt: new Date().toISOString(),
    };
    expect(job.type).toBe("notification_ranking_change");
  });

  it("all notification job types are valid", () => {
    const types: NotificationJobType[] = [
      "notification_ranking_change",
      "notification_new_competitor",
      "notification_new_review",
      "notification_milestone",
      "notification_price_change",
      "notification_category_change",
    ];
    expect(types).toHaveLength(6);
  });
});
