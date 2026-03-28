import Redis from "ioredis";
import { createLogger } from "@appranks/shared";

const log = createLogger("circuit-breaker");

const REDIS_PREFIX = "circuit:";
/** Failures before opening the circuit */
const FAILURE_THRESHOLD = parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || "5", 10);
/** How long the circuit stays open before half-open test (ms) */
const OPEN_DURATION_MS = parseInt(process.env.CIRCUIT_BREAKER_OPEN_DURATION_MS || "3600000", 10);
/** Redis key TTL — auto-cleanup after 24h of inactivity */
const KEY_TTL_SECONDS = 86400;

export type CircuitState = "closed" | "open" | "half-open";

interface CircuitData {
  state: CircuitState;
  failures: number;
  lastFailureAt: number;
  openedAt: number;
}

let redis: Redis | null = null;
let disabled = false;

function getRedis(): Redis | null {
  if (disabled) return null;
  if (redis) return redis;
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  try {
    redis = new Redis(url, {
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    redis.connect().catch(() => {
      redis = null;
    });
    return redis;
  } catch {
    return null;
  }
}

/** Reset Redis for testing */
export function _resetCircuitRedis(mock?: Redis | null): void {
  if (mock === null || mock === undefined) {
    redis = null;
    disabled = mock === null;
  } else {
    redis = mock;
    disabled = false;
  }
}

function redisKey(platform: string): string {
  return `${REDIS_PREFIX}${platform}`;
}

async function getData(platform: string): Promise<CircuitData> {
  const client = getRedis();
  if (!client) return { state: "closed", failures: 0, lastFailureAt: 0, openedAt: 0 };

  try {
    const raw = await client.get(redisKey(platform));
    if (!raw) return { state: "closed", failures: 0, lastFailureAt: 0, openedAt: 0 };
    return JSON.parse(raw);
  } catch {
    return { state: "closed", failures: 0, lastFailureAt: 0, openedAt: 0 };
  }
}

async function setData(platform: string, data: CircuitData): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.set(redisKey(platform), JSON.stringify(data), "EX", KEY_TTL_SECONDS);
  } catch {
    // Redis unavailable
  }
}

/**
 * Check if a platform's circuit allows requests.
 *
 * - CLOSED: allow (normal operation)
 * - OPEN: block if within open duration, otherwise transition to HALF-OPEN
 * - HALF-OPEN: allow (testing if platform recovered)
 */
export async function isCircuitOpen(platform: string): Promise<boolean> {
  const data = await getData(platform);

  if (data.state === "closed") return false;

  if (data.state === "open") {
    const elapsed = Date.now() - data.openedAt;
    if (elapsed >= OPEN_DURATION_MS) {
      // Transition to half-open
      await setData(platform, { ...data, state: "half-open" });
      log.info("circuit half-open (testing)", { platform });
      return false; // Allow one test request
    }
    return true; // Still open, block
  }

  // half-open: allow
  return false;
}

/**
 * Record a successful request for a platform.
 * If half-open, closes the circuit.
 */
export async function recordSuccess(platform: string): Promise<void> {
  const data = await getData(platform);

  if (data.state === "half-open") {
    await setData(platform, { state: "closed", failures: 0, lastFailureAt: 0, openedAt: 0 });
    log.info("circuit closed (recovered)", { platform });
  } else if (data.failures > 0) {
    // Reset failure count on success
    await setData(platform, { ...data, failures: 0 });
  }
}

/**
 * Record a failure for a platform.
 * If failures exceed threshold, opens the circuit.
 */
export async function recordFailure(platform: string): Promise<void> {
  const data = await getData(platform);
  const newFailures = data.failures + 1;
  const now = Date.now();

  if (data.state === "half-open" || newFailures >= FAILURE_THRESHOLD) {
    await setData(platform, {
      state: "open",
      failures: newFailures,
      lastFailureAt: now,
      openedAt: now,
    });
    log.warn("circuit opened", { platform, failures: newFailures, openDurationMs: OPEN_DURATION_MS });
  } else {
    await setData(platform, {
      ...data,
      failures: newFailures,
      lastFailureAt: now,
    });
    log.info("failure recorded", { platform, failures: newFailures, threshold: FAILURE_THRESHOLD });
  }
}

/**
 * Get circuit state for a platform (for admin API).
 */
export async function getCircuitState(platform: string): Promise<CircuitData & { platform: string }> {
  const data = await getData(platform);
  return { platform, ...data };
}

/**
 * Force-set circuit state (admin override).
 */
export async function overrideCircuit(platform: string, state: CircuitState): Promise<void> {
  const data = await getData(platform);
  if (state === "closed") {
    await setData(platform, { state: "closed", failures: 0, lastFailureAt: 0, openedAt: 0 });
  } else if (state === "open") {
    await setData(platform, { ...data, state: "open", openedAt: Date.now() });
  } else {
    await setData(platform, { ...data, state: "half-open" });
  }
  log.info("circuit overridden", { platform, newState: state });
}
