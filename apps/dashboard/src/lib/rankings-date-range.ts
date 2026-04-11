export const RANKINGS_DATE_RANGE_STORAGE_KEY = "rankings-date-range";

export type RankingsDateRangePreset = "30d" | "90d" | "180d" | "365d" | "custom";

export interface RankingsDateRangeSelection {
  preset: RankingsDateRangePreset;
  from: string;
  to: string;
  days: number;
}

export const RANKINGS_PRESETS: Array<{
  label: string;
  value: Exclude<RankingsDateRangePreset, "custom">;
  days: number;
}> = [
  { label: "Last month", value: "30d", days: 30 },
  { label: "Last 3 months", value: "90d", days: 90 },
  { label: "Last 6 months", value: "180d", days: 180 },
  { label: "Last year", value: "365d", days: 365 },
];

const PRESET_BY_DAYS = new Map(RANKINGS_PRESETS.map((preset) => [preset.days, preset.value]));

type SearchParamSource =
  | URLSearchParams
  | { get(name: string): string | null }
  | { days?: string; from?: string; to?: string };

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

function getParam(source: SearchParamSource, key: "days" | "from" | "to"): string | undefined {
  if ("get" in source) {
    return source.get(key) ?? undefined;
  }
  return source[key];
}

export function getRangeDaySpan(from: string, to: string): number {
  const fromDate = parseDateString(from);
  const toDate = parseDateString(to);
  if (!fromDate || !toDate || fromDate > toDate) return 0;

  const diffMs = toDate.getTime() - fromDate.getTime();
  return Math.floor(diffMs / 86_400_000) + 1;
}

export function getPresetRange(
  preset: Exclude<RankingsDateRangePreset, "custom">,
  now: Date = new Date()
): RankingsDateRangeSelection {
  const presetMeta = RANKINGS_PRESETS.find((item) => item.value === preset) ?? RANKINGS_PRESETS[0];
  const to = formatDateString(now);
  const from = formatDateString(subtractDays(now, presetMeta.days - 1));

  return {
    preset: presetMeta.value,
    from,
    to,
    days: presetMeta.days,
  };
}

export function getDefaultRankingsDateRange(now: Date = new Date()): RankingsDateRangeSelection {
  return getPresetRange("30d", now);
}

export function getRankingsDateRangeFromSearchParams(
  source: SearchParamSource,
  now: Date = new Date()
): RankingsDateRangeSelection {
  const from = getParam(source, "from");
  const to = getParam(source, "to");
  const parsedFrom = from ? parseDateString(from) : null;
  const parsedTo = to ? parseDateString(to) : null;

  if (parsedFrom && parsedTo && parsedFrom <= parsedTo) {
    const safeFrom = from!;
    const safeTo = to!;
    return {
      preset: "custom",
      from: safeFrom,
      to: safeTo,
      days: getRangeDaySpan(safeFrom, safeTo),
    };
  }

  const parsedDays = Number.parseInt(getParam(source, "days") ?? "", 10);
  const preset = PRESET_BY_DAYS.get(parsedDays);
  if (preset) {
    return getPresetRange(preset, now);
  }

  return getDefaultRankingsDateRange(now);
}

export function getRankingsFetchDays(
  selection: RankingsDateRangeSelection,
  now: Date = new Date()
): number {
  if (selection.preset !== "custom") {
    return selection.days;
  }

  const fromDate = parseDateString(selection.from);
  if (!fromDate) return getDefaultRankingsDateRange(now).days;

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffMs = today.getTime() - fromDate.getTime();
  return Math.max(1, Math.floor(diffMs / 86_400_000) + 1);
}

export function isDateWithinRange(value: string, from: string, to: string): boolean {
  const candidate = parseDateString(value.slice(0, 10));
  const fromDate = parseDateString(from);
  const toDate = parseDateString(to);
  if (!candidate || !fromDate || !toDate) return false;
  return candidate >= fromDate && candidate <= toDate;
}

export function buildRankingsSearchParams(
  selection: RankingsDateRangeSelection,
  current?: URLSearchParams | { toString(): string }
): string {
  const params = new URLSearchParams(current ? current.toString() : "");

  if (selection.preset === "custom") {
    params.delete("days");
    params.set("from", selection.from);
    params.set("to", selection.to);
  } else {
    params.delete("from");
    params.delete("to");
    params.set("days", String(selection.days));
  }

  return params.toString();
}

export function parseStoredRankingsDateRange(raw: string | null): RankingsDateRangeSelection | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<RankingsDateRangeSelection>;
    if (parsed.preset === "custom" && typeof parsed.from === "string" && typeof parsed.to === "string") {
      const span = getRangeDaySpan(parsed.from, parsed.to);
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
        return getPresetRange(preset);
      }
    }
  } catch {
    return null;
  }

  return null;
}
