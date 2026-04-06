import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../digest-builder.js", () => ({
  buildDigestForAccount: vi.fn(),
  getDigestRecipients: vi.fn(),
}));

vi.mock("../digest-template.js", () => ({
  buildDigestHtml: vi.fn(),
  buildDigestSubject: vi.fn(),
}));

vi.mock("../weekly-builder.js", () => ({
  buildWeeklyForAccount: vi.fn(),
  getWeeklyRecipients: vi.fn(),
}));

vi.mock("../weekly-template.js", () => ({
  buildWeeklyHtml: vi.fn(),
  buildWeeklySubject: vi.fn(),
}));

vi.mock("@appranks/shared", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { dryRunPreview, bulkDryRun } from "../dry-run.js";
import { buildDigestForAccount, getDigestRecipients } from "../digest-builder.js";
import { buildDigestHtml, buildDigestSubject } from "../digest-template.js";
import { buildWeeklyForAccount, getWeeklyRecipients } from "../weekly-builder.js";
import { buildWeeklyHtml, buildWeeklySubject } from "../weekly-template.js";

const mockDb = {} as any;

describe("dry-run", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("dryRunPreview", () => {
    it("generates daily digest preview with correct structure", async () => {
      const digestData = {
        summary: { totalApps: 5 },
        trackedApps: [
          { keywordChanges: [{ keyword: "kw1" }, { keyword: "kw2" }] },
        ],
      };
      vi.mocked(buildDigestForAccount).mockResolvedValue(digestData as any);
      vi.mocked(buildDigestSubject).mockReturnValue("Daily Digest - Apr 3");
      vi.mocked(buildDigestHtml).mockReturnValue("<html>digest</html>");

      const result = await dryRunPreview(mockDb, "daily_digest", "acc-1", "UTC");

      expect(result).not.toBeNull();
      expect(result!.emailType).toBe("daily_digest");
      expect(result!.subject).toBe("Daily Digest - Apr 3");
      expect(result!.html).toBe("<html>digest</html>");
      expect(result!.recipientCount).toBe(1);
      expect(result!.dataSnapshot).toEqual({
        summary: { totalApps: 5 },
        rankingCount: 2,
      });
    });

    it("generates weekly summary preview", async () => {
      const weeklyData = {
        summary: { weekNumber: 14 },
        rankings: [{ appId: "app-1" }],
      };
      vi.mocked(buildWeeklyForAccount).mockResolvedValue(weeklyData as any);
      vi.mocked(buildWeeklySubject).mockReturnValue("Weekly Summary");
      vi.mocked(buildWeeklyHtml).mockReturnValue("<html>weekly</html>");

      const result = await dryRunPreview(mockDb, "weekly_summary", "acc-1");

      expect(result).not.toBeNull();
      expect(result!.emailType).toBe("weekly_summary");
      expect(result!.subject).toBe("Weekly Summary");
      expect(result!.dataSnapshot).toEqual({
        summary: { weekNumber: 14 },
        rankingCount: 1,
      });
    });

    it("returns null when builder returns no data", async () => {
      vi.mocked(buildDigestForAccount).mockResolvedValue(null as any);
      const result = await dryRunPreview(mockDb, "daily_digest", "acc-1");
      expect(result).toBeNull();
    });

    it("returns null for unsupported email type", async () => {
      const result = await dryRunPreview(mockDb, "unknown_type", "acc-1");
      expect(result).toBeNull();
    });
  });

  describe("bulkDryRun", () => {
    it("returns eligible count for daily digest recipients", async () => {
      vi.mocked(getDigestRecipients).mockResolvedValue([
        { email: "a@test.com", accountId: "acc-1" },
        { email: "b@test.com", accountId: "acc-1" },
        { email: "c@test.com", accountId: "acc-2" },
      ]);
      vi.mocked(buildDigestForAccount).mockResolvedValue(null as any);

      const result = await bulkDryRun(mockDb, "daily_digest");

      expect(result.emailType).toBe("daily_digest");
      expect(result.eligibleCount).toBe(3);
    });

    it("collects sample subjects from up to 5 accounts", async () => {
      const recipients = Array.from({ length: 8 }, (_, i) => ({
        email: `user${i}@test.com`,
        accountId: `acc-${i}`,
      }));
      vi.mocked(getWeeklyRecipients).mockResolvedValue(recipients);

      const digestData = { summary: {}, rankings: [] };
      vi.mocked(buildWeeklyForAccount).mockResolvedValue(digestData as any);
      vi.mocked(buildWeeklySubject).mockReturnValue("Weekly Report");
      vi.mocked(buildWeeklyHtml).mockReturnValue("<html/>");

      const result = await bulkDryRun(mockDb, "weekly_summary");

      expect(result.sampleSubjects).toHaveLength(5);
      expect(result.sampleSubjects[0]).toBe("Weekly Report");
    });

    it("handles preview failures gracefully during bulk run", async () => {
      vi.mocked(getDigestRecipients).mockResolvedValue([
        { email: "a@test.com", accountId: "acc-1" },
        { email: "b@test.com", accountId: "acc-2" },
      ]);
      vi.mocked(buildDigestForAccount)
        .mockRejectedValueOnce(new Error("DB connection lost"))
        .mockResolvedValueOnce({
          summary: {},
          trackedApps: [],
        } as any);
      vi.mocked(buildDigestSubject).mockReturnValue("Digest");
      vi.mocked(buildDigestHtml).mockReturnValue("<html/>");

      const result = await bulkDryRun(mockDb, "daily_digest");

      // First account failed, second succeeded
      expect(result.eligibleCount).toBe(2);
      expect(result.sampleSubjects).toHaveLength(1);
    });

    it("returns empty results for unsupported email type", async () => {
      const result = await bulkDryRun(mockDb, "unknown_type");

      expect(result.eligibleCount).toBe(0);
      expect(result.sampleSubjects).toEqual([]);
      expect(result.accountNames).toEqual([]);
    });
  });
});
