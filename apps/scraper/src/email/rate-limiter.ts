/**
 * Adaptive email rate limiter (PLA-685).
 *
 * Tracks SMTP provider responses and dynamically adjusts the send rate.
 * When throttled (429/rate limit), reduces rate. When sustained success,
 * gradually recovers back to the configured maximum.
 */
import { createLogger } from "@appranks/shared";

const log = createLogger("email:rate-limiter");

export interface RateLimiterConfig {
  /** Maximum sends per minute (default from env or 50) */
  maxPerMinute: number;
  /** Minimum sends per minute (floor when throttled) */
  minPerMinute: number;
  /** How much to reduce rate on throttle (factor, e.g. 0.5 = halve) */
  throttleReductionFactor: number;
  /** How much to recover per successful batch (additive per minute) */
  recoveryIncrement: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxPerMinute: parseInt(process.env.EMAIL_RATE_LIMIT_PER_MINUTE || "50", 10),
  minPerMinute: 5,
  throttleReductionFactor: 0.5,
  recoveryIncrement: 5,
};

export class AdaptiveRateLimiter {
  private _config: RateLimiterConfig;
  private _currentRate: number;
  private _consecutiveSuccesses = 0;
  private _lastThrottleAt: number | null = null;

  constructor(config?: Partial<RateLimiterConfig>) {
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._currentRate = this._config.maxPerMinute;
  }

  /** Current sends-per-minute rate */
  get currentRate(): number {
    return this._currentRate;
  }

  /** Whether the rate has been reduced from maximum */
  get isThrottled(): boolean {
    return this._currentRate < this._config.maxPerMinute;
  }

  /** Time since last throttle event (ms), or null if never throttled */
  get timeSinceThrottle(): number | null {
    return this._lastThrottleAt ? Date.now() - this._lastThrottleAt : null;
  }

  /**
   * Record a successful send — gradually recover rate if throttled.
   */
  recordSuccess(): void {
    this._consecutiveSuccesses++;

    // Every 10 consecutive successes, try to recover rate
    if (this._consecutiveSuccesses >= 10 && this._currentRate < this._config.maxPerMinute) {
      this._currentRate = Math.min(
        this._config.maxPerMinute,
        this._currentRate + this._config.recoveryIncrement
      );
      this._consecutiveSuccesses = 0;

      log.info("rate recovered", {
        currentRate: this._currentRate,
        maxRate: this._config.maxPerMinute,
      });
    }
  }

  /**
   * Record a rate limit / throttle event — reduce send rate.
   */
  recordThrottle(): void {
    const previousRate = this._currentRate;
    this._currentRate = Math.max(
      this._config.minPerMinute,
      Math.floor(this._currentRate * this._config.throttleReductionFactor)
    );
    this._consecutiveSuccesses = 0;
    this._lastThrottleAt = Date.now();

    log.warn("rate throttled", {
      previousRate,
      newRate: this._currentRate,
      minRate: this._config.minPerMinute,
    });
  }

  /**
   * Check if an error indicates rate limiting.
   */
  isRateLimitError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /rate\s*limit|too\s*many|429|throttl/i.test(message);
  }

  /**
   * Get the BullMQ limiter configuration for the current rate.
   */
  getBullMQConfig(): { max: number; duration: number } {
    return {
      max: this._currentRate,
      duration: 60_000, // per minute
    };
  }

  /**
   * Get a snapshot of the current state.
   */
  getSnapshot(): {
    currentRate: number;
    maxRate: number;
    minRate: number;
    isThrottled: boolean;
    consecutiveSuccesses: number;
    lastThrottleAt: string | null;
  } {
    return {
      currentRate: this._currentRate,
      maxRate: this._config.maxPerMinute,
      minRate: this._config.minPerMinute,
      isThrottled: this.isThrottled,
      consecutiveSuccesses: this._consecutiveSuccesses,
      lastThrottleAt: this._lastThrottleAt
        ? new Date(this._lastThrottleAt).toISOString()
        : null,
    };
  }

  /** Reset to max rate */
  reset(): void {
    this._currentRate = this._config.maxPerMinute;
    this._consecutiveSuccesses = 0;
    this._lastThrottleAt = null;
  }
}

/** Singleton for the bulk email rate limiter */
export const bulkRateLimiter = new AdaptiveRateLimiter();
