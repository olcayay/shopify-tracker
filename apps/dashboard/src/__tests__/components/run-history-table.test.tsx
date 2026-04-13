import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunHistoryTable } from "@/app/(dashboard)/system-admin/scraper/components/run-history-table";

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ fetchWithAuth: vi.fn() }),
}));
vi.mock("@/lib/format-date", () => ({
  useFormatDate: () => ({ formatDateTime: (s: string) => s }),
}));

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1126785-1111-2222-3333-444455556666",
    scraperType: "app_details",
    status: "running",
    platform: "salesforce",
    jobId: "33",
    createdAt: "2026-04-13T09:51:00Z",
    startedAt: "2026-04-13T09:51:07Z",
    completedAt: null,
    triggeredBy: "manual-http-validation",
    queue: "interactive",
    metadata: { items_scraped: 1998 },
    error: null,
    assets: [],
    ...overrides,
  };
}

describe("RunHistoryTable — PLA-1061 identifier disambiguation", () => {
  const baseProps = {
    total: 2,
    page: 0,
    filterType: "",
    filterTrigger: "",
    filterQueue: "",
    filterPlatform: "",
    filterStatus: "",
    onPageChange: vi.fn(),
    onFilterTypeChange: vi.fn(),
    onFilterTriggerChange: vi.fn(),
    onFilterQueueChange: vi.fn(),
    onFilterPlatformChange: vi.fn(),
    onFilterStatusChange: vi.fn(),
    onRetry: vi.fn(),
    onRefresh: vi.fn(),
    retryingRunId: null,
  };

  it("renders short UUID as primary identifier and BullMQ id as secondary", () => {
    const run = makeRun();
    render(<RunHistoryTable {...baseProps} runs={[run]} />);
    expect(screen.getByText("a1126785")).toBeTruthy();
    expect(screen.getByText("bullmq:33")).toBeTruthy();
  });

  it("disambiguates two rows that share the same BullMQ job id", () => {
    const runs = [
      makeRun({ id: "aaaaaaaa-1111-2222-3333-444455556666", jobId: "33" }),
      makeRun({ id: "bbbbbbbb-1111-2222-3333-444455556666", jobId: "33" }),
    ];
    render(<RunHistoryTable {...baseProps} runs={runs} total={2} />);
    expect(screen.getByText("aaaaaaaa")).toBeTruthy();
    expect(screen.getByText("bbbbbbbb")).toBeTruthy();
    expect(screen.getAllByText("bullmq:33")).toHaveLength(2);
  });

  it("shows only the UUID when jobId is missing", () => {
    const run = makeRun({ jobId: null });
    render(<RunHistoryTable {...baseProps} runs={[run]} />);
    expect(screen.getByText("a1126785")).toBeTruthy();
    expect(screen.queryByText(/bullmq:/)).toBeNull();
  });

  it("column header is 'Run' (not 'Job ID')", () => {
    render(<RunHistoryTable {...baseProps} runs={[]} total={0} />);
    expect(screen.getByText("Run")).toBeTruthy();
    expect(screen.queryByText("Job ID")).toBeNull();
  });
});
