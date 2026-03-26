/**
 * Tracks when fallback scraping is used during a job.
 * Created per-job and passed through platform modules to withFallback() calls.
 */
export class FallbackTracker {
  private _contexts: string[] = [];

  recordFallback(context: string): void {
    this._contexts.push(context);
  }

  get fallbackUsed(): boolean {
    return this._contexts.length > 0;
  }

  get fallbackCount(): number {
    return this._contexts.length;
  }

  get contexts(): readonly string[] {
    return this._contexts;
  }

  toMetadata(): Record<string, unknown> {
    if (!this.fallbackUsed) return {};
    return {
      fallback_used: true,
      fallback_count: this._contexts.length,
      fallback_contexts: this._contexts,
    };
  }
}
