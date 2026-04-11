/**
 * Generate an array of ISO date strings (YYYY-MM-DD) for a window of `days` length,
 * ending `offset` days before today.
 *
 * @param days - Number of days in the window (default 30)
 * @param offset - Number of days to shift back from today (default 0 = ends today)
 */
export function buildDateRange(days: number = 30, offset: number = 0): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = days - 1 + offset; i >= offset; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })}`;
}

/**
 * Format a date range string like "12 Mar — 11 Apr 2026"
 */
export function formatDateRangeLabel(dates: string[]): string {
  if (dates.length === 0) return "";
  const first = dates[0];
  const last = dates[dates.length - 1];
  const start = new Date(first + "T00:00:00");
  const end = new Date(last + "T00:00:00");
  const startStr = `${start.getDate()} ${start.toLocaleString("en", { month: "short" })}`;
  const endStr = `${end.getDate()} ${end.toLocaleString("en", { month: "short" })} ${end.getFullYear()}`;
  return `${startStr} — ${endStr}`;
}

export function intensityClass(count: number): string {
  if (count === 0) return "bg-muted/40";
  if (count === 1) return "bg-primary/25";
  if (count === 2) return "bg-primary/50";
  return "bg-primary/80";
}
