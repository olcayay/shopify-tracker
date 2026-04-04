import { describe, it, expect, beforeEach } from "vitest";
import {
  cronStarted,
  cronSucceeded,
  cronFailed,
  getCronHistory,
  getRunningCrons,
  getCronSummary,
  _resetCronHistory,
} from "../cron-monitor.js";

describe("cron-monitor", () => {
  beforeEach(() => {
    _resetCronHistory();
  });

  it("tracks successful cron execution", () => {
    cronStarted("daily_digest");
    cronSucceeded("daily_digest", 5);

    const history = getCronHistory();
    expect(history).toHaveLength(1);
    expect(history[0].cronName).toBe("daily_digest");
    expect(history[0].status).toBe("success");
    expect(history[0].jobsEnqueued).toBe(5);
    expect(history[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("tracks failed cron execution", () => {
    cronStarted("weekly_summary");
    cronFailed("weekly_summary", new Error("DB connection lost"));

    const history = getCronHistory();
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("failed");
    expect(history[0].error).toBe("DB connection lost");
  });

  it("tracks running crons", () => {
    cronStarted("alert_evaluator");
    const running = getRunningCrons();
    expect(running).toHaveLength(1);
    expect(running[0].cronName).toBe("alert_evaluator");
    expect(running[0].status).toBe("running");

    cronSucceeded("alert_evaluator");
    expect(getRunningCrons()).toHaveLength(0);
  });

  it("filters history by cron name", () => {
    cronStarted("a"); cronSucceeded("a");
    cronStarted("b"); cronSucceeded("b");
    cronStarted("a"); cronSucceeded("a");

    expect(getCronHistory({ cronName: "a" })).toHaveLength(2);
    expect(getCronHistory({ cronName: "b" })).toHaveLength(1);
  });

  it("filters history by status", () => {
    cronStarted("a"); cronSucceeded("a");
    cronStarted("b"); cronFailed("b", "err");
    cronStarted("c"); cronSucceeded("c");

    expect(getCronHistory({ status: "success" })).toHaveLength(2);
    expect(getCronHistory({ status: "failed" })).toHaveLength(1);
  });

  it("limits history size", () => {
    expect(getCronHistory({ limit: 1 })).toHaveLength(0);

    cronStarted("a"); cronSucceeded("a");
    cronStarted("b"); cronSucceeded("b");
    cronStarted("c"); cronSucceeded("c");

    expect(getCronHistory({ limit: 2 })).toHaveLength(2);
  });

  it("provides summary", () => {
    cronStarted("a"); cronSucceeded("a");
    cronStarted("b"); cronFailed("b", "err");
    cronStarted("c"); // still running

    const summary = getCronSummary();
    expect(summary.totalExecutions).toBe(2);
    expect(summary.recentFailures).toBe(1);
    expect(summary.currentlyRunning).toBe(1);
    expect(summary.cronNames).toContain("a");
    expect(summary.lastExecution?.cronName).toBe("b");
  });

  it("handles cronSucceeded without prior cronStarted", () => {
    cronSucceeded("orphan", 3);
    const history = getCronHistory();
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("success");
    expect(history[0].durationMs).toBe(0);
  });
});
