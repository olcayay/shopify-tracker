/**
 * Format a number with locale-aware grouping (e.g. 1234 → "1,234").
 * With `compact: true`, uses compact notation (e.g. 1234 → "1.2K").
 * With `decimals`, controls the number of fraction digits.
 */
export function formatNumber(
  value: number,
  opts?: { compact?: boolean; decimals?: number },
): string {
  if (opts?.compact) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: opts.decimals ?? 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: opts?.decimals,
  }).format(value);
}

/**
 * Format a number as currency (e.g. 4200 → "$4,200", 42.5 → "$42.50").
 */
export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number as a percentage (e.g. 0.125 → "12.5%").
 * With `alreadyPercent: true`, treats the input as already a percentage value.
 */
export function formatPercent(
  value: number,
  opts?: { alreadyPercent?: boolean; decimals?: number },
): string {
  const pct = opts?.alreadyPercent ? value : value * 100;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: opts?.decimals ?? 1,
  }).format(pct)}%`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

/** Format a date string as "Jan 5" (short month + day). */
export function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Format a date string as "Jan 5, 2026" (short month + day + year). */
export function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format a date string as "Jan 2026" (month + year). */
export function formatMonthYear(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / (1000 * 60));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
