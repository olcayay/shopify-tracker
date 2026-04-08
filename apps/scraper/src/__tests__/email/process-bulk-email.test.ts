import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import type { BulkEmailJobData } from "@appranks/shared";

// Mock the email pipeline
const mockSendEmail = vi.fn().mockResolvedValue({ sent: true, logId: "log-1" });
vi.mock("../../email/pipeline.js", () => ({
  sendEmail: (...args: any[]) => mockSendEmail(...args),
}));

// Mock digest builder
const mockBuildDigestForAccount = vi.fn().mockResolvedValue({
  accountName: "Test Account",
  highlight: null,
  summaryBadges: [],
  winsAndAttention: [],
  competitorWatch: [],
});
const mockSplitDigestByPlatform = vi.fn((data: any) => data ? [{ ...data, platform: "shopify" }] : []);
vi.mock("../../email/digest-builder.js", () => ({
  buildDigestForAccount: (...args: any[]) => mockBuildDigestForAccount(...args),
  getDigestRecipients: vi.fn(),
  splitDigestByPlatform: (...args: any[]) => mockSplitDigestByPlatform(...args),
}));

const mockBuildDigestHtml = vi.fn().mockReturnValue("<html>digest</html>");
const mockBuildDigestSubject = vi.fn().mockReturnValue("Daily Digest");
vi.mock("../../email/digest-template.js", () => ({
  buildDigestHtml: (...args: any[]) => mockBuildDigestHtml(...args),
  buildDigestSubject: (...args: any[]) => mockBuildDigestSubject(...args),
}));

// Mock weekly builder
const mockBuildWeeklyForAccount = vi.fn().mockResolvedValue({ data: "weekly" });
vi.mock("../../email/weekly-builder.js", () => ({
  buildWeeklyForAccount: (...args: any[]) => mockBuildWeeklyForAccount(...args),
  getWeeklyRecipients: vi.fn(),
}));

const mockBuildWeeklyHtml = vi.fn().mockReturnValue("<html>weekly</html>");
const mockBuildWeeklySubject = vi.fn().mockReturnValue("Weekly Summary");
vi.mock("../../email/weekly-template.js", () => ({
  buildWeeklyHtml: (...args: any[]) => mockBuildWeeklyHtml(...args),
  buildWeeklySubject: (...args: any[]) => mockBuildWeeklySubject(...args),
}));

// Mock alert templates
vi.mock("../../email/ranking-alert-template.js", () => ({
  buildRankingAlertHtml: vi.fn().mockReturnValue("<html>ranking</html>"),
  buildRankingAlertSubject: vi.fn().mockReturnValue("Ranking Alert"),
}));

const { processBulkEmail } = await import("../../email/process-bulk-email.js");

function makeJob(data: BulkEmailJobData): Job<BulkEmailJobData> {
  return {
    id: "bulk-job-1",
    data,
    attemptsMade: 1,
    opts: { attempts: 2 },
  } as unknown as Job<BulkEmailJobData>;
}

const mockDb = {} as any;

describe("processBulkEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes daily digest by building data from DB and using pipeline", async () => {
    const job = makeJob({
      type: "email_daily_digest",
      to: "user@test.com",
      name: "Alice",
      userId: "u1",
      accountId: "a1",
      payload: { timezone: "America/New_York" },
      createdAt: new Date().toISOString(),
    });

    await processBulkEmail(job, mockDb);

    // Built digest data from DB
    expect(mockBuildDigestForAccount).toHaveBeenCalledWith(mockDb, "a1", "America/New_York");
    // Split into per-platform digests
    expect(mockSplitDigestByPlatform).toHaveBeenCalledOnce();
    // Rendered template for each platform
    expect(mockBuildDigestHtml).toHaveBeenCalledOnce();
    expect(mockBuildDigestSubject).toHaveBeenCalledOnce();
    // Sent via pipeline
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      db: mockDb,
      emailType: "email_daily_digest",
      userId: "u1",
      accountId: "a1",
      recipientEmail: "user@test.com",
      subject: "Daily Digest",
      htmlBody: "<html>digest</html>",
    }));
  });

  it("skips when digest has no data", async () => {
    mockBuildDigestForAccount.mockResolvedValueOnce(null);

    const job = makeJob({
      type: "email_daily_digest",
      to: "user@test.com",
      name: "Alice",
      userId: "u1",
      accountId: "a1",
      payload: {},
      createdAt: new Date().toISOString(),
    });

    await processBulkEmail(job, mockDb);

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("processes weekly summary", async () => {
    const job = makeJob({
      type: "email_weekly_summary",
      to: "user@test.com",
      name: "Bob",
      userId: "u2",
      accountId: "a1",
      payload: { timezone: "UTC" },
      createdAt: new Date().toISOString(),
    });

    await processBulkEmail(job, mockDb);

    expect(mockBuildWeeklyForAccount).toHaveBeenCalledWith(mockDb, "a1", "UTC");
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      emailType: "email_weekly_summary",
      subject: "Weekly Summary",
    }));
  });

  it("processes ranking alert using payload data", async () => {
    const job = makeJob({
      type: "email_ranking_alert",
      to: "user@test.com",
      name: "Charlie",
      userId: "u3",
      accountId: "a1",
      payload: { appName: "Test App", oldRank: 5, newRank: 2 },
      createdAt: new Date().toISOString(),
    });

    await processBulkEmail(job, mockDb);

    // For alerts, payload is used directly (not built from DB)
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      emailType: "email_ranking_alert",
      recipientEmail: "user@test.com",
      subject: "Ranking Alert",
    }));
  });

  it("throws for unknown bulk email type", async () => {
    const job = makeJob({
      type: "email_unknown" as any,
      to: "user@test.com",
      name: "Test",
      userId: "u1",
      accountId: "a1",
      payload: {},
      createdAt: new Date().toISOString(),
    });

    await expect(processBulkEmail(job, mockDb)).rejects.toThrow(
      "Unknown bulk email type: email_unknown"
    );
  });

  it("handles pipeline rejection as sent=false without throwing", async () => {
    mockSendEmail.mockResolvedValueOnce({ sent: false, skipReason: "frequency cap" });

    const job = makeJob({
      type: "email_daily_digest",
      to: "user@test.com",
      name: "Alice",
      userId: "u1",
      accountId: "a1",
      payload: {},
      createdAt: new Date().toISOString(),
    });

    // Should not throw — skipped emails are normal
    await processBulkEmail(job, mockDb);

    expect(mockSendEmail).toHaveBeenCalledOnce();
  });
});
