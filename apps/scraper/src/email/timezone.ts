/**
 * Timezone-aware scheduling utilities.
 *
 * Uses Intl.DateTimeFormat for timezone conversion — no external dependencies.
 * Node.js ships with full IANA timezone data via ICU.
 */

const DEFAULT_TIMEZONE = "Europe/Istanbul";
const DEFAULT_TARGET_HOUR = 8; // 8 AM local time

/**
 * Get the local hour and minute for a given timezone at a specific instant.
 */
export function getLocalTime(
  date: Date,
  timezone: string
): { hour: number; minute: number; dateStr: string } {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const year = parts.find((p) => p.type === "year")?.value ?? "";
    const month = parts.find((p) => p.type === "month")?.value ?? "";
    const day = parts.find((p) => p.type === "day")?.value ?? "";
    return { hour, minute, dateStr: `${year}-${month}-${day}` };
  } catch {
    // Invalid timezone — fall back to default
    return getLocalTime(date, DEFAULT_TIMEZONE);
  }
}

/**
 * Check if a user should receive their digest email now.
 *
 * Returns true if the user's local time is within the delivery window
 * (targetHour:00 to targetHour:14) — matching the 15-minute cron interval.
 */
export function isInDeliveryWindow(
  now: Date,
  timezone: string,
  targetHour: number = DEFAULT_TARGET_HOUR
): boolean {
  const local = getLocalTime(now, timezone);
  return local.hour === targetHour && local.minute < 15;
}

/**
 * Get "today" and "yesterday" date boundaries in a user's local timezone.
 *
 * Returns UTC Date objects that represent midnight boundaries in the user's timezone.
 * Used for querying ranking data scoped to the user's local day.
 */
export function getLocalDayBoundaries(
  now: Date,
  timezone: string
): { todayStart: Date; yesterdayStart: Date } {
  const local = getLocalTime(now, timezone);

  // Build a local midnight string and convert to UTC
  // Format: YYYY-MM-DDTHH:mm:ss in the target timezone
  const todayMidnight = new Date(
    new Date(
      `${local.dateStr}T00:00:00`
    ).toLocaleString("en-US", { timeZone: "UTC" })
  );

  // Use the timezone offset approach: find what UTC time corresponds to local midnight
  const todayStart = getUtcForLocalMidnight(now, timezone);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  return { todayStart, yesterdayStart };
}

/**
 * Find the UTC instant that corresponds to midnight (00:00) in the given timezone
 * for the current local date.
 */
function getUtcForLocalMidnight(now: Date, timezone: string): Date {
  const local = getLocalTime(now, timezone);

  // Start from current time and subtract local hours/minutes to approximate midnight
  const approxMidnight = new Date(now.getTime());
  approxMidnight.setUTCHours(
    approxMidnight.getUTCHours() - local.hour,
    approxMidnight.getUTCMinutes() - local.minute,
    0,
    0
  );

  // Verify and adjust: check what local time our approximation maps to
  const check = getLocalTime(approxMidnight, timezone);
  if (check.hour !== 0 || check.minute !== 0) {
    // Adjust for DST edge cases — try ±1 hour
    for (const offset of [-3600000, 3600000]) {
      const adjusted = new Date(approxMidnight.getTime() + offset);
      const recheck = getLocalTime(adjusted, timezone);
      if (recheck.hour === 0 && recheck.dateStr === local.dateStr) {
        return adjusted;
      }
    }
  }

  return approxMidnight;
}

/**
 * Check if a digest was already sent today (in the user's local timezone).
 */
export function alreadySentToday(
  lastSentAt: Date | null,
  now: Date,
  timezone: string
): boolean {
  if (!lastSentAt) return false;
  const nowLocal = getLocalTime(now, timezone);
  const sentLocal = getLocalTime(lastSentAt, timezone);
  return nowLocal.dateStr === sentLocal.dateStr;
}

export { DEFAULT_TIMEZONE, DEFAULT_TARGET_HOUR };
