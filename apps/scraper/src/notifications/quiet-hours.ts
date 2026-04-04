/**
 * Quiet Hours & Do Not Disturb mode for notifications (PLA-689).
 *
 * - Quiet Hours: recurring daily window (e.g. 22:00–07:00) — no push, in-app still saved
 * - DND Mode: temporary override (e.g. "mute for 2 hours") — nothing delivered
 */
import { createLogger } from "@appranks/shared";

const log = createLogger("notification:quiet-hours");

export interface QuietHoursConfig {
  enabled: boolean;
  /** Start hour in 24h format (0-23) */
  startHour: number;
  /** End hour in 24h format (0-23) */
  endHour: number;
  /** IANA timezone (e.g. "Europe/Istanbul") */
  timezone: string;
}

export interface DndConfig {
  enabled: boolean;
  /** ISO timestamp when DND expires (null = indefinite until manually disabled) */
  expiresAt: string | null;
}

/** In-memory per-user config (replace with DB for persistence) */
const userQuietHours = new Map<string, QuietHoursConfig>();
const userDnd = new Map<string, DndConfig>();

/**
 * Set quiet hours for a user.
 */
export function setQuietHours(userId: string, config: QuietHoursConfig): void {
  userQuietHours.set(userId, config);
}

/**
 * Get quiet hours config for a user.
 */
export function getQuietHours(userId: string): QuietHoursConfig | null {
  return userQuietHours.get(userId) ?? null;
}

/**
 * Enable DND mode for a user.
 * @param durationMinutes — 0 or undefined for indefinite
 */
export function enableDnd(userId: string, durationMinutes?: number): void {
  const expiresAt = durationMinutes && durationMinutes > 0
    ? new Date(Date.now() + durationMinutes * 60_000).toISOString()
    : null;
  userDnd.set(userId, { enabled: true, expiresAt });
  log.info("DND enabled", { userId, durationMinutes, expiresAt });
}

/**
 * Disable DND mode.
 */
export function disableDnd(userId: string): void {
  userDnd.delete(userId);
}

/**
 * Get DND config for a user.
 */
export function getDndConfig(userId: string): DndConfig | null {
  const config = userDnd.get(userId);
  if (!config) return null;

  // Auto-expire
  if (config.expiresAt && new Date(config.expiresAt) < new Date()) {
    userDnd.delete(userId);
    return null;
  }

  return config;
}

/**
 * Check if a user is currently in quiet hours.
 * Supports cross-midnight ranges (e.g. 22:00–07:00).
 */
export function isInQuietHours(userId: string, now?: Date): boolean {
  const config = userQuietHours.get(userId);
  if (!config?.enabled) return false;

  const currentTime = now ?? new Date();

  // Get current hour in user's timezone
  let currentHour: number;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: config.timezone,
    });
    currentHour = parseInt(formatter.format(currentTime), 10);
  } catch {
    // Fallback to UTC
    currentHour = currentTime.getUTCHours();
  }

  const { startHour, endHour } = config;

  if (startHour <= endHour) {
    // Same-day range (e.g. 09:00–17:00)
    return currentHour >= startHour && currentHour < endHour;
  } else {
    // Cross-midnight range (e.g. 22:00–07:00)
    return currentHour >= startHour || currentHour < endHour;
  }
}

/**
 * Check if a user is in DND mode.
 */
export function isInDnd(userId: string): boolean {
  return !!getDndConfig(userId);
}

/**
 * Should we suppress push notifications for this user right now?
 * Returns { suppress: boolean, reason?: string }
 */
export function shouldSuppressPush(userId: string): { suppress: boolean; reason?: string } {
  if (isInDnd(userId)) {
    return { suppress: true, reason: "dnd_active" };
  }
  if (isInQuietHours(userId)) {
    return { suppress: true, reason: "quiet_hours" };
  }
  return { suppress: false };
}

/**
 * Should we suppress ALL notifications (including in-app)?
 * Only DND suppresses everything. Quiet hours only suppress push.
 */
export function shouldSuppressAll(userId: string): { suppress: boolean; reason?: string } {
  if (isInDnd(userId)) {
    return { suppress: true, reason: "dnd_active" };
  }
  return { suppress: false };
}

/** Reset state (for testing) */
export function _resetQuietHours(): void {
  userQuietHours.clear();
  userDnd.clear();
}
