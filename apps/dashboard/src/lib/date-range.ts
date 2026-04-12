export interface DateRangePreset {
  label: string;
  value: string;
  days: number;
}

export interface DateRangeConfig {
  storageKey: string;
  params: { days: string; from: string; to: string };
  presets: DateRangePreset[];
  defaultPresetValue: string;
}

export interface DateRangeSelection {
  preset: string;
  from: string;
  to: string;
  days: number;
}

type SearchParamSource =
  | URLSearchParams
  | { get(name: string): string | null }
  | Record<string, string | undefined>;

function parseDateString(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return date;
}

function formatDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function subtractDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}

function getParam(source: SearchParamSource, key: string): string | undefined {
  if (typeof (source as URLSearchParams).get === "function") {
    return (source as URLSearchParams).get(key) ?? undefined;
  }
  return (source as Record<string, string | undefined>)[key];
}

export function getRangeDaySpan(from: string, to: string): number {
  const fromDate = parseDateString(from);
  const toDate = parseDateString(to);
  if (!fromDate || !toDate || fromDate > toDate) return 0;
  const diffMs = toDate.getTime() - fromDate.getTime();
  return Math.floor(diffMs / 86_400_000) + 1;
}

export function isDateWithinRange(value: string, from: string, to: string): boolean {
  if (!value) return false;
  const candidate = parseDateString(value.slice(0, 10));
  const fromDate = parseDateString(from);
  const toDate = parseDateString(to);
  if (!candidate || !fromDate || !toDate) return false;
  return candidate >= fromDate && candidate <= toDate;
}

export function getPresetRange(
  presetValue: string,
  config: DateRangeConfig,
  now: Date = new Date()
): DateRangeSelection {
  const presetMeta =
    config.presets.find((item) => item.value === presetValue) ??
    config.presets.find((item) => item.value === config.defaultPresetValue) ??
    config.presets[0];
  const to = formatDateString(now);
  const from = formatDateString(subtractDays(now, presetMeta.days - 1));

  return {
    preset: presetMeta.value,
    from,
    to,
    days: presetMeta.days,
  };
}

export function getDefaultDateRange(
  config: DateRangeConfig,
  now: Date = new Date()
): DateRangeSelection {
  return getPresetRange(config.defaultPresetValue, config, now);
}

export function getDateRangeFromSearchParams(
  source: SearchParamSource,
  config: DateRangeConfig,
  now: Date = new Date()
): DateRangeSelection {
  const from = getParam(source, config.params.from);
  const to = getParam(source, config.params.to);
  const parsedFrom = from ? parseDateString(from) : null;
  const parsedTo = to ? parseDateString(to) : null;

  if (parsedFrom && parsedTo && parsedFrom <= parsedTo) {
    return {
      preset: "custom",
      from: from!,
      to: to!,
      days: getRangeDaySpan(from!, to!),
    };
  }

  const parsedDays = Number.parseInt(getParam(source, config.params.days) ?? "", 10);
  const matchedPreset = config.presets.find((item) => item.days === parsedDays);
  if (matchedPreset) {
    return getPresetRange(matchedPreset.value, config, now);
  }

  return getDefaultDateRange(config, now);
}

export function buildDateRangeSearchParams(
  selection: DateRangeSelection,
  config: DateRangeConfig,
  current?: URLSearchParams | { toString(): string }
): string {
  const params = new URLSearchParams(current ? current.toString() : "");

  if (selection.preset === "custom") {
    params.delete(config.params.days);
    params.set(config.params.from, selection.from);
    params.set(config.params.to, selection.to);
  } else {
    params.delete(config.params.from);
    params.delete(config.params.to);
    params.set(config.params.days, String(selection.days));
  }

  return params.toString();
}

export function parseStoredDateRange(
  raw: string | null,
  config: DateRangeConfig
): DateRangeSelection | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<DateRangeSelection>;

    if (parsed.preset === "custom" && typeof parsed.from === "string" && typeof parsed.to === "string") {
      const span = getRangeDaySpan(parsed.from, parsed.to);
      if (span > 0) {
        return { preset: "custom", from: parsed.from, to: parsed.to, days: span };
      }
    }

    if (typeof parsed.days === "number") {
      const matched = config.presets.find((item) => item.days === parsed.days);
      if (matched) return getPresetRange(matched.value, config);
    }
  } catch {
    return null;
  }

  return null;
}

export function getFetchDaysFromStart(
  selection: DateRangeSelection,
  config: DateRangeConfig,
  now: Date = new Date()
): number {
  if (selection.preset !== "custom") return selection.days;

  const fromDate = parseDateString(selection.from);
  if (!fromDate) return getDefaultDateRange(config, now).days;

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffMs = today.getTime() - fromDate.getTime();
  return Math.max(1, Math.floor(diffMs / 86_400_000) + 1);
}

const DEFAULT_PRESETS: DateRangePreset[] = [
  { label: "Last month", value: "30d", days: 30 },
  { label: "Last 3 months", value: "90d", days: 90 },
  { label: "Last 6 months", value: "180d", days: 180 },
  { label: "Last year", value: "365d", days: 365 },
];

export const RANKINGS_DATE_RANGE_CONFIG: DateRangeConfig = {
  storageKey: "rankings-date-range",
  params: { days: "days", from: "from", to: "to" },
  presets: DEFAULT_PRESETS,
  defaultPresetValue: "30d",
};

export const REVIEW_TREND_DATE_RANGE_CONFIG: DateRangeConfig = {
  storageKey: "review-trend-date-range",
  params: { days: "trendDays", from: "trendFrom", to: "trendTo" },
  presets: DEFAULT_PRESETS,
  defaultPresetValue: "90d",
};
