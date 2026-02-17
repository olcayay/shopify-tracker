import { useAuth } from "./auth-context";

const DEFAULT_TZ = "Europe/Istanbul";

/** Parse a date string as UTC (DB timestamps lack Z suffix) */
function parseUTC(dateStr: string): Date {
  if (/[Zz]$/.test(dateStr) || /[+-]\d{2}(:\d{2})?$/.test(dateStr)) {
    return new Date(dateStr);
  }
  return new Date(dateStr.replace(" ", "T") + "Z");
}

/** Full date+time: "17.02.2026, 14:30" */
export function formatDateTime(dateStr: string, timezone: string = DEFAULT_TZ): string {
  return parseUTC(dateStr).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

/** Date only: "17.02.2026" */
export function formatDateOnly(dateStr: string, timezone: string = DEFAULT_TZ): string {
  return parseUTC(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: timezone,
  });
}

/** Hook that returns timezone-aware formatters using the current user's timezone */
export function useFormatDate() {
  const { user } = useAuth();
  const tz = user?.timezone || DEFAULT_TZ;

  return {
    formatDateTime: (dateStr: string) => formatDateTime(dateStr, tz),
    formatDateOnly: (dateStr: string) => formatDateOnly(dateStr, tz),
  };
}
