import { createLogger } from "@appranks/shared";

const log = createLogger("smtp:circuit-breaker");

export type CircuitState = "closed" | "open" | "half-open";

export interface SmtpProviderConfig {
  name: string;
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  priority: number;
}

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms to keep circuit open before trying half-open (default: 5 minutes) */
  resetTimeoutMs?: number;
}

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_RESET_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class SmtpCircuitBreaker {
  public readonly provider: SmtpProviderConfig;
  private _state: CircuitState = "closed";
  private _failCount = 0;
  private _lastFailAt: number | null = null;
  private _failureThreshold: number;
  private _resetTimeoutMs: number;

  constructor(provider: SmtpProviderConfig, options?: CircuitBreakerOptions) {
    this.provider = provider;
    this._failureThreshold = options?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this._resetTimeoutMs = options?.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS;
  }

  get state(): CircuitState {
    // Auto-transition from open to half-open when reset timeout has elapsed
    if (this._state === "open" && this._lastFailAt) {
      const elapsed = Date.now() - this._lastFailAt;
      if (elapsed >= this._resetTimeoutMs) {
        this._state = "half-open";
        log.info("circuit half-open", { provider: this.provider.name });
      }
    }
    return this._state;
  }

  get failCount(): number {
    return this._failCount;
  }

  get lastFailAt(): number | null {
    return this._lastFailAt;
  }

  /** Whether this provider is available for sending */
  isAvailable(): boolean {
    const currentState = this.state; // triggers auto-transition
    return currentState === "closed" || currentState === "half-open";
  }

  /** Record a successful send — resets the circuit to closed */
  recordSuccess(): void {
    if (this._state !== "closed") {
      log.info("circuit closed after success", { provider: this.provider.name });
    }
    this._state = "closed";
    this._failCount = 0;
    this._lastFailAt = null;
  }

  /** Record a failure — may open the circuit */
  recordFailure(): void {
    this._failCount++;
    this._lastFailAt = Date.now();

    if (this._state === "half-open") {
      // Failed during probe — reopen immediately
      this._state = "open";
      log.warn("circuit re-opened (half-open probe failed)", {
        provider: this.provider.name,
        failCount: this._failCount,
      });
    } else if (this._failCount >= this._failureThreshold) {
      this._state = "open";
      log.warn("circuit opened", {
        provider: this.provider.name,
        failCount: this._failCount,
      });
    }
  }

  /** Force the circuit to a specific state (for health checks) */
  forceState(state: CircuitState): void {
    this._state = state;
    if (state === "closed") {
      this._failCount = 0;
      this._lastFailAt = null;
    }
    log.info("circuit forced", { provider: this.provider.name, state });
  }
}
