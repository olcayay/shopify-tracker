/**
 * In-memory metrics collector for email workers.
 * Tracks processing counts, durations, and rolling averages.
 */

export interface MetricSnapshot {
  processedTotal: number;
  failedTotal: number;
  processedLastMinute: number;
  failedLastMinute: number;
  avgProcessingMs: number;
  avgQueueWaitMs: number;
  activeJobs: number;
  uptimeMs: number;
  lastProcessedAt: string | null;
  lastFailedAt: string | null;
}

interface TimedValue {
  value: number;
  timestamp: number;
}

const ROLLING_WINDOW_MS = 60_000; // 1 minute

export class WorkerMetrics {
  private _processedTotal = 0;
  private _failedTotal = 0;
  private _activeJobs = 0;
  private _startedAt = Date.now();
  private _lastProcessedAt: number | null = null;
  private _lastFailedAt: number | null = null;

  private _processingDurations: TimedValue[] = [];
  private _queueWaitTimes: TimedValue[] = [];
  private _recentProcessed: TimedValue[] = [];
  private _recentFailed: TimedValue[] = [];

  /** Record a successfully processed job */
  recordSuccess(processingMs: number, queueWaitMs?: number): void {
    const now = Date.now();
    this._processedTotal++;
    this._lastProcessedAt = now;
    this._recentProcessed.push({ value: 1, timestamp: now });
    this._processingDurations.push({ value: processingMs, timestamp: now });
    if (queueWaitMs !== undefined) {
      this._queueWaitTimes.push({ value: queueWaitMs, timestamp: now });
    }
    this._cleanup(now);
  }

  /** Record a failed job */
  recordFailure(processingMs?: number): void {
    const now = Date.now();
    this._failedTotal++;
    this._lastFailedAt = now;
    this._recentFailed.push({ value: 1, timestamp: now });
    if (processingMs !== undefined) {
      this._processingDurations.push({ value: processingMs, timestamp: now });
    }
    this._cleanup(now);
  }

  /** Increment active job count */
  jobStarted(): void {
    this._activeJobs++;
  }

  /** Decrement active job count */
  jobFinished(): void {
    this._activeJobs = Math.max(0, this._activeJobs - 1);
  }

  /** Get current metric snapshot */
  getSnapshot(): MetricSnapshot {
    const now = Date.now();
    this._cleanup(now);

    return {
      processedTotal: this._processedTotal,
      failedTotal: this._failedTotal,
      processedLastMinute: this._recentProcessed.length,
      failedLastMinute: this._recentFailed.length,
      avgProcessingMs: this._rollingAverage(this._processingDurations),
      avgQueueWaitMs: this._rollingAverage(this._queueWaitTimes),
      activeJobs: this._activeJobs,
      uptimeMs: now - this._startedAt,
      lastProcessedAt: this._lastProcessedAt
        ? new Date(this._lastProcessedAt).toISOString()
        : null,
      lastFailedAt: this._lastFailedAt
        ? new Date(this._lastFailedAt).toISOString()
        : null,
    };
  }

  /** Reset all metrics */
  reset(): void {
    this._processedTotal = 0;
    this._failedTotal = 0;
    this._activeJobs = 0;
    this._startedAt = Date.now();
    this._lastProcessedAt = null;
    this._lastFailedAt = null;
    this._processingDurations = [];
    this._queueWaitTimes = [];
    this._recentProcessed = [];
    this._recentFailed = [];
  }

  private _rollingAverage(entries: TimedValue[]): number {
    if (entries.length === 0) return 0;
    const sum = entries.reduce((acc, e) => acc + e.value, 0);
    return Math.round(sum / entries.length);
  }

  private _cleanup(now: number): void {
    const cutoff = now - ROLLING_WINDOW_MS;
    this._recentProcessed = this._recentProcessed.filter((e) => e.timestamp > cutoff);
    this._recentFailed = this._recentFailed.filter((e) => e.timestamp > cutoff);
    this._processingDurations = this._processingDurations.filter((e) => e.timestamp > cutoff);
    this._queueWaitTimes = this._queueWaitTimes.filter((e) => e.timestamp > cutoff);
  }
}

/** Singleton metrics instances for each worker type */
export const instantWorkerMetrics = new WorkerMetrics();
export const bulkWorkerMetrics = new WorkerMetrics();
