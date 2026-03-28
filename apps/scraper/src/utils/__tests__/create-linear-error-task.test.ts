import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLinearErrorTask } from "../create-linear-error-task.js";

// Mock linear-client
vi.mock("../linear-client.js", () => ({
  ensureScrapingErrorLabel: vi.fn(),
  createLinearIssue: vi.fn(),
}));

import { ensureScrapingErrorLabel, createLinearIssue } from "../linear-client.js";

const mockEnsureLabel = ensureScrapingErrorLabel as ReturnType<typeof vi.fn>;
const mockCreateIssue = createLinearIssue as ReturnType<typeof vi.fn>;

function createMockDb(runs: any[], errors: any[]) {
  const updatedRows: Array<{ id: string; values: any }> = [];

  return {
    db: {
      select: () => {
        let fromTable: string | null = null;
        let whereResult: any[] = [];
        return {
          from: (table: any) => {
            // Detect which table by checking for known fields
            if (table === "scrapeRuns" || !errors.length) {
              fromTable = "runs";
            }
            return {
              where: (condition: any) => {
                if (fromTable === "runs") {
                  whereResult = runs;
                } else {
                  whereResult = errors;
                }
                return Promise.resolve(whereResult);
              },
            };
          },
        };
      },
      update: (table: any) => ({
        set: (values: any) => ({
          where: (condition: any) => {
            updatedRows.push({ id: "unknown", values });
            return Promise.resolve();
          },
        }),
      }),
    } as any,
    updatedRows,
  };
}

// A more realistic mock DB that handles multiple calls correctly
function createRealisticMockDb(opts: {
  runs: Array<{ id: string; status: string }>;
  errorsByRun: Record<string, Array<{
    id: string;
    scrapeRunId: string;
    itemIdentifier: string;
    itemType: string;
    url: string | null;
    errorMessage: string;
  }>>;
}) {
  const updatedRows: Array<{ values: any }> = [];
  let selectCallIndex = 0;

  const db = {
    select: (fields?: any) => ({
      from: (table: any) => ({
        where: () => {
          selectCallIndex++;
          // First select call: scrape_runs by jobId
          if (selectCallIndex === 1) {
            return Promise.resolve(opts.runs);
          }
          // Subsequent calls: errors by runId
          const runIndex = selectCallIndex - 2;
          const runId = opts.runs[runIndex]?.id;
          return Promise.resolve(runId ? (opts.errorsByRun[runId] || []) : []);
        },
      }),
    }),
    update: () => ({
      set: (values: any) => ({
        where: () => {
          updatedRows.push({ values });
          return Promise.resolve();
        },
      }),
    }),
  } as any;

  return { db, updatedRows };
}

describe("createLinearErrorTask", () => {
  const originalEnv = process.env.LINEAR_API_KEY;

  beforeEach(() => {
    process.env.LINEAR_API_KEY = "lin_api_test";
    mockEnsureLabel.mockReset();
    mockCreateIssue.mockReset();
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.LINEAR_API_KEY = originalEnv;
    } else {
      delete process.env.LINEAR_API_KEY;
    }
  });

  it("returns early when jobId is undefined", async () => {
    const { db } = createRealisticMockDb({ runs: [], errorsByRun: {} });
    await createLinearErrorTask(db, undefined, "shopify", "app_details");
    expect(mockEnsureLabel).not.toHaveBeenCalled();
  });

  it("returns early when LINEAR_API_KEY is not set", async () => {
    delete process.env.LINEAR_API_KEY;
    const { db } = createRealisticMockDb({ runs: [], errorsByRun: {} });
    await createLinearErrorTask(db, "job-1", "shopify", "app_details");
    expect(mockEnsureLabel).not.toHaveBeenCalled();
  });

  it("returns early when no runs found for jobId", async () => {
    const { db } = createRealisticMockDb({ runs: [], errorsByRun: {} });
    await createLinearErrorTask(db, "job-1", "shopify", "app_details");
    expect(mockEnsureLabel).not.toHaveBeenCalled();
  });

  it("returns early when no errors found for runs", async () => {
    const { db } = createRealisticMockDb({
      runs: [{ id: "run-1", status: "completed" }],
      errorsByRun: { "run-1": [] },
    });
    await createLinearErrorTask(db, "job-1", "shopify", "app_details");
    expect(mockEnsureLabel).not.toHaveBeenCalled();
  });

  it("creates a Linear issue when errors exist", async () => {
    mockEnsureLabel.mockResolvedValue("label-123");
    mockCreateIssue.mockResolvedValue({
      id: "issue-id",
      identifier: "PLA-999",
      url: "https://linear.app/plan-b/issue/PLA-999",
    });

    const { db, updatedRows } = createRealisticMockDb({
      runs: [{ id: "run-1", status: "completed" }],
      errorsByRun: {
        "run-1": [
          {
            id: "err-1",
            scrapeRunId: "run-1",
            itemIdentifier: "my-app",
            itemType: "app",
            url: "https://apps.shopify.com/my-app",
            errorMessage: "HTTP 429 Too Many Requests",
          },
          {
            id: "err-2",
            scrapeRunId: "run-1",
            itemIdentifier: "other-app",
            itemType: "app",
            url: null,
            errorMessage: "HTTP 429 Too Many Requests",
          },
        ],
      },
    });

    await createLinearErrorTask(db, "job-1", "shopify", "app_details");

    expect(mockCreateIssue).toHaveBeenCalledTimes(1);
    const callArgs = mockCreateIssue.mock.calls[0][0];
    expect(callArgs.title).toBe("[Shopify] App Details: 2 items failed");
    expect(callArgs.description).toContain("my-app");
    expect(callArgs.description).toContain("other-app");
    expect(callArgs.description).toContain("HTTP 429 Too Many Requests");
    expect(callArgs.labelIds).toContain("label-123");
    expect(callArgs.priority).toBe(4); // 2 errors = Low

    // Should update error rows with Linear issue reference
    expect(updatedRows.length).toBe(2);
    expect(updatedRows[0].values.linearIssueId).toBe("PLA-999");
    expect(updatedRows[0].values.linearIssueUrl).toBe("https://linear.app/plan-b/issue/PLA-999");
  });

  it("sets priority based on error count", async () => {
    mockEnsureLabel.mockResolvedValue("label-123");
    mockCreateIssue.mockResolvedValue({
      id: "issue-id",
      identifier: "PLA-100",
      url: "https://linear.app/issue/PLA-100",
    });

    // 10 errors -> High priority
    const errors = Array.from({ length: 10 }, (_, i) => ({
      id: `err-${i}`,
      scrapeRunId: "run-1",
      itemIdentifier: `app-${i}`,
      itemType: "app",
      url: null,
      errorMessage: "timeout",
    }));

    const { db } = createRealisticMockDb({
      runs: [{ id: "run-1", status: "completed" }],
      errorsByRun: { "run-1": errors },
    });

    await createLinearErrorTask(db, "job-1", "shopify", "app_details");

    expect(mockCreateIssue.mock.calls[0][0].priority).toBe(2); // High
  });

  it("sets urgent priority when job failed", async () => {
    mockEnsureLabel.mockResolvedValue("label-123");
    mockCreateIssue.mockResolvedValue({
      id: "issue-id",
      identifier: "PLA-101",
      url: "https://linear.app/issue/PLA-101",
    });

    const { db } = createRealisticMockDb({
      runs: [{ id: "run-1", status: "failed" }],
      errorsByRun: {
        "run-1": [{
          id: "err-1",
          scrapeRunId: "run-1",
          itemIdentifier: "app-1",
          itemType: "app",
          url: null,
          errorMessage: "fatal crash",
        }],
      },
    });

    await createLinearErrorTask(db, "job-1", "shopify", "app_details");

    expect(mockCreateIssue.mock.calls[0][0].priority).toBe(1); // Urgent
  });

  it("does not throw on Linear API failure", async () => {
    mockEnsureLabel.mockRejectedValue(new Error("network error"));

    const { db } = createRealisticMockDb({
      runs: [{ id: "run-1", status: "completed" }],
      errorsByRun: {
        "run-1": [{
          id: "err-1",
          scrapeRunId: "run-1",
          itemIdentifier: "app-1",
          itemType: "app",
          url: null,
          errorMessage: "some error",
        }],
      },
    });

    // Should not throw
    await expect(
      createLinearErrorTask(db, "job-1", "shopify", "app_details")
    ).resolves.toBeUndefined();
  });

  it("groups errors by message pattern in the body", async () => {
    mockEnsureLabel.mockResolvedValue("label-123");
    mockCreateIssue.mockResolvedValue({
      id: "issue-id",
      identifier: "PLA-102",
      url: "https://linear.app/issue/PLA-102",
    });

    const { db } = createRealisticMockDb({
      runs: [{ id: "run-1", status: "completed" }],
      errorsByRun: {
        "run-1": [
          { id: "e1", scrapeRunId: "run-1", itemIdentifier: "a1", itemType: "app", url: null, errorMessage: "HTTP 429 Too Many Requests" },
          { id: "e2", scrapeRunId: "run-1", itemIdentifier: "a2", itemType: "app", url: null, errorMessage: "HTTP 429 Too Many Requests" },
          { id: "e3", scrapeRunId: "run-1", itemIdentifier: "a3", itemType: "app", url: null, errorMessage: "Timeout after 30s" },
        ],
      },
    });

    await createLinearErrorTask(db, "job-1", "shopify", "app_details");

    const body = mockCreateIssue.mock.calls[0][0].description;
    expect(body).toContain("2 occurrences");
    expect(body).toContain("1 occurrence");
    expect(body).toContain("HTTP 429");
    expect(body).toContain("Timeout after 30s");
  });

  it("uses correct platform display name in title", async () => {
    mockEnsureLabel.mockResolvedValue("label-123");
    mockCreateIssue.mockResolvedValue({
      id: "issue-id",
      identifier: "PLA-103",
      url: "https://linear.app/issue/PLA-103",
    });

    const { db } = createRealisticMockDb({
      runs: [{ id: "run-1", status: "completed" }],
      errorsByRun: {
        "run-1": [{
          id: "e1", scrapeRunId: "run-1", itemIdentifier: "a1",
          itemType: "app", url: null, errorMessage: "fail",
        }],
      },
    });

    await createLinearErrorTask(db, "job-1", "salesforce", "category");

    expect(mockCreateIssue.mock.calls[0][0].title).toBe("[Salesforce] Category: 1 item failed");
  });
});
