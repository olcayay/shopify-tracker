import { describe, it, expect, beforeEach } from "vitest";
import { WorkerMetrics } from "../worker-metrics.js";

describe("WorkerMetrics", () => {
  let metrics: WorkerMetrics;

  beforeEach(() => {
    metrics = new WorkerMetrics();
  });

  it("starts with zero counts", () => {
    const snap = metrics.getSnapshot();
    expect(snap.processedTotal).toBe(0);
    expect(snap.failedTotal).toBe(0);
    expect(snap.activeJobs).toBe(0);
    expect(snap.processedLastMinute).toBe(0);
    expect(snap.failedLastMinute).toBe(0);
    expect(snap.avgProcessingMs).toBe(0);
    expect(snap.avgQueueWaitMs).toBe(0);
    expect(snap.lastProcessedAt).toBeNull();
    expect(snap.lastFailedAt).toBeNull();
  });

  it("tracks uptime", () => {
    const snap = metrics.getSnapshot();
    expect(snap.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  describe("recordSuccess", () => {
    it("increments processed counts", () => {
      metrics.recordSuccess(100);
      metrics.recordSuccess(200);
      const snap = metrics.getSnapshot();
      expect(snap.processedTotal).toBe(2);
      expect(snap.processedLastMinute).toBe(2);
    });

    it("tracks average processing time", () => {
      metrics.recordSuccess(100);
      metrics.recordSuccess(200);
      metrics.recordSuccess(300);
      const snap = metrics.getSnapshot();
      expect(snap.avgProcessingMs).toBe(200); // (100+200+300)/3
    });

    it("tracks queue wait time when provided", () => {
      metrics.recordSuccess(100, 50);
      metrics.recordSuccess(200, 150);
      const snap = metrics.getSnapshot();
      expect(snap.avgQueueWaitMs).toBe(100); // (50+150)/2
    });

    it("updates lastProcessedAt", () => {
      metrics.recordSuccess(100);
      const snap = metrics.getSnapshot();
      expect(snap.lastProcessedAt).not.toBeNull();
    });
  });

  describe("recordFailure", () => {
    it("increments failed counts", () => {
      metrics.recordFailure(50);
      const snap = metrics.getSnapshot();
      expect(snap.failedTotal).toBe(1);
      expect(snap.failedLastMinute).toBe(1);
    });

    it("updates lastFailedAt", () => {
      metrics.recordFailure();
      const snap = metrics.getSnapshot();
      expect(snap.lastFailedAt).not.toBeNull();
    });
  });

  describe("active jobs", () => {
    it("tracks active job count", () => {
      metrics.jobStarted();
      metrics.jobStarted();
      expect(metrics.getSnapshot().activeJobs).toBe(2);

      metrics.jobFinished();
      expect(metrics.getSnapshot().activeJobs).toBe(1);
    });

    it("does not go below zero", () => {
      metrics.jobFinished();
      metrics.jobFinished();
      expect(metrics.getSnapshot().activeJobs).toBe(0);
    });
  });

  describe("reset", () => {
    it("resets all metrics", () => {
      metrics.recordSuccess(100);
      metrics.recordFailure(50);
      metrics.jobStarted();
      metrics.reset();

      const snap = metrics.getSnapshot();
      expect(snap.processedTotal).toBe(0);
      expect(snap.failedTotal).toBe(0);
      expect(snap.activeJobs).toBe(0);
      expect(snap.processedLastMinute).toBe(0);
      expect(snap.failedLastMinute).toBe(0);
      expect(snap.lastProcessedAt).toBeNull();
      expect(snap.lastFailedAt).toBeNull();
    });
  });

  describe("mixed success and failure", () => {
    it("tracks both independently", () => {
      metrics.recordSuccess(100);
      metrics.recordSuccess(200);
      metrics.recordFailure(50);
      metrics.recordSuccess(300);
      metrics.recordFailure(75);

      const snap = metrics.getSnapshot();
      expect(snap.processedTotal).toBe(3);
      expect(snap.failedTotal).toBe(2);
      expect(snap.processedLastMinute).toBe(3);
      expect(snap.failedLastMinute).toBe(2);
    });
  });
});
