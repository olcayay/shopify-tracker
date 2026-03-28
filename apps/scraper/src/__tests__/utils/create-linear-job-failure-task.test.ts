import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock linear-client before importing the module under test
vi.mock("../../utils/linear-client.js", () => ({
  ensureScrapingErrorLabel: vi.fn(),
  createLinearIssue: vi.fn(),
}));

import { createLinearJobFailureTask } from "../../utils/create-linear-job-failure-task.js";
import { ensureScrapingErrorLabel, createLinearIssue } from "../../utils/linear-client.js";

const mockEnsureLabel = vi.mocked(ensureScrapingErrorLabel);
const mockCreateIssue = vi.mocked(createLinearIssue);

describe("createLinearJobFailureTask", () => {
  const originalEnv = process.env.LINEAR_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LINEAR_API_KEY = "test-key";
    mockEnsureLabel.mockResolvedValue("label-123");
    mockCreateIssue.mockResolvedValue({
      id: "issue-id",
      identifier: "PLA-999",
      url: "https://linear.app/test/PLA-999",
    });
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.LINEAR_API_KEY = originalEnv;
    } else {
      delete process.env.LINEAR_API_KEY;
    }
  });

  it("creates a Linear issue for a stalled job", async () => {
    await createLinearJobFailureTask(
      "1969",
      "background",
      "shopify",
      "reviews",
      "job stalled more than allowable limit",
      3,
    );

    expect(mockCreateIssue).toHaveBeenCalledOnce();
    const call = mockCreateIssue.mock.calls[0][0];
    expect(call.title).toContain("Shopify");
    expect(call.title).toContain("reviews");
    expect(call.title).toContain("1969");
    expect(call.description).toContain("job stalled more than allowable limit");
    expect(call.description).toContain("**Attempts Made:** 3");
    expect(call.priority).toBe(1); // Urgent
    expect(call.labelIds).toContain("label-123");
  });

  it("skips when LINEAR_API_KEY is not set", async () => {
    delete process.env.LINEAR_API_KEY;

    await createLinearJobFailureTask("1", "bg", "shopify", "reviews", "err", 1);

    expect(mockEnsureLabel).not.toHaveBeenCalled();
    expect(mockCreateIssue).not.toHaveBeenCalled();
  });

  it("skips when label cannot be fetched", async () => {
    mockEnsureLabel.mockResolvedValue(null);

    await createLinearJobFailureTask("1", "bg", "shopify", "reviews", "err", 1);

    expect(mockCreateIssue).not.toHaveBeenCalled();
  });

  it("handles unknown platform gracefully", async () => {
    await createLinearJobFailureTask("1", "bg", undefined, "reviews", "err", 1);

    expect(mockCreateIssue).toHaveBeenCalledOnce();
    const call = mockCreateIssue.mock.calls[0][0];
    expect(call.title).toContain("Unknown");
  });

  it("does not throw when createLinearIssue fails", async () => {
    mockCreateIssue.mockRejectedValue(new Error("API down"));

    // Should not throw
    await createLinearJobFailureTask("1", "bg", "shopify", "reviews", "err", 1);
  });

  it("includes queue name and job type in description", async () => {
    await createLinearJobFailureTask("42", "interactive", "salesforce", "category", "timeout", 2);

    const call = mockCreateIssue.mock.calls[0][0];
    expect(call.description).toContain("**Queue:** interactive");
    expect(call.description).toContain("**Job Type:** category");
    expect(call.description).toContain("**Platform:** Salesforce");
    expect(call.description).toContain("**Job ID:** 42");
  });
});
