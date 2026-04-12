/**
 * Resolve scraper runtime config = code defaults merged with DB overrides.
 *
 * Called at job start (process-job.ts) + by the admin API's GET endpoints.
 * Overrides arrive as a JSONB object from `scraper_configs.overrides` with
 * either flat keys (`appDetailsConcurrency`) or dotted keys (`rateLimit.minDelayMs`).
 * The resolver unflattens them onto the default PlatformConstants-shaped tree.
 *
 * In-memory LRU cache (~60s TTL) protects the DB from per-HTTP-request reads.
 * `invalidateConfigCache()` is exported for Phase 2's PATCH endpoint.
 */
import { eq, and } from "drizzle-orm";
import type { PlatformId } from "@appranks/shared";
import { scraperConfigs } from "@appranks/db";
import type { Database } from "@appranks/db";
import { getPlatformConstants } from "./platforms/registry.js";
import type { PlatformConstants } from "./platforms/platform-module.js";
import type { ScraperJobType } from "./queue.js";
import * as GLOBAL_CONSTANTS from "./constants.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("config-resolver");
import { SCRAPER_CONFIG_SCHEMA } from "./config-schema.js";

/** Result of resolving one (platform, scraperType) pair. */
export interface ResolvedScraperConfig {
  platform: PlatformId;
  scraperType: ScraperJobType;
  /** DB-level enable flag (false → scraper should be skipped). */
  enabled: boolean;
  /** Merged config: code defaults + DB overrides. Shape follows PlatformConstants + global constants. */
  merged: PlatformConstants & Record<string, unknown>;
  /** Raw JSON from `scraper_configs.overrides` (empty object = use all defaults). */
  overrides: Record<string, unknown>;
  /** Just the code defaults (pre-override), for diff display in the UI. */
  defaults: PlatformConstants & Record<string, unknown>;
}

interface CacheEntry {
  value: ResolvedScraperConfig;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

function cacheKey(platform: PlatformId, type: ScraperJobType): string {
  return `${platform}:${type}`;
}

/**
 * Set a nested value into `target` at the dotted path `key` (e.g. "rateLimit.minDelayMs").
 * Flat keys like "appDetailsConcurrency" are set at the root.
 */
function setPath(target: Record<string, unknown>, key: string, value: unknown): void {
  if (!key.includes(".")) {
    target[key] = value;
    return;
  }
  const parts = key.split(".");
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const segment = parts[i];
    const next = cursor[segment];
    if (next == null || typeof next !== "object") {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

/** Deep-clone via JSON (sufficient for plain config shapes). */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Build the code-default view for a (platform, scraperType). Starts with the
 * platform's PlatformConstants and layers in the registered global knobs so the
 * UI sees them in one shape (e.g. `jobTimeoutMs` → JOB_TIMEOUT_APP_DETAILS_MS).
 */
function buildCodeDefaults(
  platform: PlatformId,
  scraperType: ScraperJobType
): PlatformConstants & Record<string, unknown> {
  const platformConstants = getPlatformConstants(platform);
  const defaults = clone((platformConstants ?? {}) as PlatformConstants) as PlatformConstants &
    Record<string, unknown>;

  const typeSchema = SCRAPER_CONFIG_SCHEMA[scraperType];
  if (typeSchema) {
    for (const [knobKey, knob] of Object.entries(typeSchema)) {
      if (knob.defaultFrom !== "global") continue;
      const globalValue = (GLOBAL_CONSTANTS as Record<string, unknown>)[knob.path];
      if (globalValue !== undefined) {
        setPath(defaults, knobKey, globalValue);
      }
    }
  }

  return defaults;
}

/**
 * Apply overrides onto a base config tree. Only keys registered in the schema
 * registry are applied — stale keys (e.g. after a registry rename) are logged
 * and skipped so old DB rows never poison runtime behavior.
 */
function applyOverrides(
  base: PlatformConstants & Record<string, unknown>,
  overrides: Record<string, unknown>,
  scraperType: ScraperJobType
): PlatformConstants & Record<string, unknown> {
  const typeSchema = SCRAPER_CONFIG_SCHEMA[scraperType];
  if (!typeSchema || Object.keys(overrides).length === 0) return base;

  const out = clone(base);
  for (const [key, value] of Object.entries(overrides)) {
    if (!(key in typeSchema)) {
      log.warn("unknown scraper config override key, ignoring", {
        module: "config-resolver",
        scraperType,
        key,
      });
      continue;
    }
    setPath(out, key, value);
  }
  return out;
}

/**
 * Resolve config for a (platform, scraperType) pair. Hits cache first; falls
 * back to DB query if missed or expired. Safe to call from hot paths.
 */
export async function resolveConfig(
  db: Database,
  platform: PlatformId,
  scraperType: ScraperJobType
): Promise<ResolvedScraperConfig> {
  const key = cacheKey(platform, scraperType);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const defaults = buildCodeDefaults(platform, scraperType);
  let overrides: Record<string, unknown> = {};
  let enabled = true;

  try {
    const rows = await db
      .select({
        enabled: scraperConfigs.enabled,
        overrides: scraperConfigs.overrides,
      })
      .from(scraperConfigs)
      .where(and(eq(scraperConfigs.platform, platform), eq(scraperConfigs.scraperType, scraperType)))
      .limit(1);

    if (rows.length > 0) {
      enabled = rows[0].enabled;
      const raw = rows[0].overrides;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        overrides = raw as Record<string, unknown>;
      }
    }
  } catch (err) {
    // DB unreachable (e.g. migration not yet applied) → fall back to defaults.
    log.warn("failed to fetch scraper config, using code defaults", {
      module: "config-resolver",
      platform,
      scraperType,
      error: String(err),
    });
  }

  const merged = applyOverrides(defaults, overrides, scraperType);
  const resolved: ResolvedScraperConfig = {
    platform,
    scraperType,
    enabled,
    merged,
    overrides,
    defaults,
  };

  cache.set(key, { value: resolved, expiresAt: Date.now() + CACHE_TTL_MS });
  return resolved;
}

/**
 * Drop the cached entry for a (platform, scraperType). Called by Phase 2's
 * PATCH/DELETE endpoints so the next resolve sees the new value without
 * waiting for TTL. Also exported for tests.
 */
export function invalidateConfigCache(platform?: PlatformId, scraperType?: ScraperJobType): void {
  if (!platform || !scraperType) {
    cache.clear();
    return;
  }
  cache.delete(cacheKey(platform, scraperType));
}

// Exposed for unit tests only.
export const __TESTING__ = {
  setPath,
  buildCodeDefaults,
  applyOverrides,
  cacheSize: () => cache.size,
};
