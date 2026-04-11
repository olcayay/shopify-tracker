export const REVIEW_TREND_DATE_RANGE_STORAGE_KEY = "review-trend-date-range";

export type ReviewTrendDateRangePreset = "30d" | "90d" | "180d" | "365d" | "custom";

export interface ReviewTrendDateRangeSelection {
  preset: ReviewTrendDateRangePreset;
  from: string;
  to: string;
  days: number;
}

export const REVIEW_TREND_PRESETS: Array<{
  label: string;
  value: Exclude<ReviewTrendDateRangePreset, "custom">;
  days: number;
}> = [
  { label: "Last month", value: "30d", days: 30 },
  { label: "Last 3 months", value: "90d", days: 90 },
  { label: "Last 6 months", value: "180d", days: 180 },
  { label: "Last year", value: "365d", days: 365 },
];

const PRESET_BY_DAYS = new Map(REVIEW_TREND_PRESETS.map((preset) => [preset.days, preset.value]));

type SearchParamSource =
  | URLSearchParams
  | { get(name: string): string | null }
  | { trendDays?: string; trendFrom?: string; trendTo?: string };

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

function getParam(source: SearchParamSource, key: "trendDays" | "trendFrom" | "trendTo"): string | undefined {
  if ("get" in source) {
    return source.get(key) ?? undefined;
  }
  return source[key];
}

export function getReviewTrendRangeDaySpan(from: string, to: string): number {
  const fromDate = parseDateString(from);
  const toDate = parseDateString(to);
  if (!fromDate || !toDate || fromDate > toDate) return 0;

  const diffMs = toDate.getTime() - fromDate.getTime();
  return Math.floor(diffMs / 86_400_000) + 1;
}

export function getReviewTrendPresetRange(
  preset: Exclude<ReviewTrendDateRangePreset, "custom">,
  now: Date = new Date()
): ReviewTrendDateRangeSelection {
  const presetMeta = REVIEW_TREND_PRESETS.find((item) => item.value === preset) ?? REVIEW_TREND_PRESETS[1];
  const to = formatDateString(now);
  const from = formatDateString(subtractDays(now, presetMeta.days - 1));

  return {
    preset: presetMeta.value,
    from,
    to,
    days: presetMeta.days,
  };
}

export function getDefaultReviewTrendDateRange(now: Date = new Date()): ReviewTrendDateRangeSelection {
  return getReviewTrendPresetRange("90d", now);
}

export function getReviewTrendDateRangeFromSearchParams(
  source: SearchParamSource,
  now: Date = new Date()
): ReviewTrendDateRangeSelection {
  const from = getParam(source, "trendFrom");
  const to = getParam(source, "trendTo");
  const parsedFrom = from ? parseDateString(from) : null;
  const parsedTo = to ? parseDateString(to) : null;

  if (parsedFrom && parsedTo && parsedFrom <= parsedTo) {
    const safeFrom = from!;
    const safeTo = to!;
    return {
      preset: "custom",
      from: safeFrom,
      to: safeTo,
      days: getReviewTrendRangeDaySpan(safeFrom, safeTo),
    };
  }

  const parsedDays = Number.parseInt(getParam(source, "trendDays") ?? "", 10);
  const preset = PRESET_BY_DAYS.get(parsedDays);
  if (preset) {
    return getReviewTrendPresetRange(preset, now);
  }

  return getDefaultReviewTrendDateRange(now);
}

export function buildReviewTrendSearchParams(
  selection: ReviewTrendDateRangeSelection,
  current?: URLSearchParams | { toString(): string }
): string {
  const params = new URLSearchParams(current ? current.toString() : "");

  if (selection.preset === "custom") {
    params.delete("trendDays");
    params.set("trendFrom", selection.from);
    params.set("trendTo", selection.to);
  } else {
    params.delete("trendFrom");
    params.delete("trendTo");
    params.set("trendDays", String(selection.days));
  }

  return params.toString();
}

export function parseStoredReviewTrendDateRange(raw: string | null): ReviewTrendDateRangeSelection | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ReviewTrendDateRangeSelection>;
    if (parsed.preset === "custom" && typeof parsed.from === "string" && typeof parsed.to === "string") {
      const span = getReviewTrendRangeDaySpan(parsed.from, parsed.to);
      if (span > 0) {
        return {
          preset: "custom",
          from: parsed.from,
          to: parsed.to,
          days: span,
        };
      }
    }

    if (typeof parsed.days === "number") {
      const preset = PRESET_BY_DAYS.get(parsed.days);
      if (preset) {
        return getReviewTrendPresetRange(preset);
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function isReviewSnapshotWithinRange(value: string, from: string, to: string): boolean {
  if (!value) return false;
  const candidate = parseDateString(value.slice(0, 10));
  const fromDate = parseDateString(from);
  const toDate = parseDateString(to);
  if (!candidate || !fromDate || !toDate) return false;
  return candidate >= fromDate && candidate <= toDate;
}

export function getReviewTrendFetchLimit(selection: ReviewTrendDateRangeSelection): number {
  if (selection.preset === "custom") {
    return Math.max(selection.days, 365);
  }
  return selection.days;
}
