"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { CalendarRange } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  RANKINGS_DATE_RANGE_STORAGE_KEY,
  RANKINGS_PRESETS,
  buildRankingsSearchParams,
  getDefaultRankingsDateRange,
  getRankingsDateRangeFromSearchParams,
  getPresetRange,
  getRangeDaySpan,
  parseStoredRankingsDateRange,
  type RankingsDateRangeSelection,
} from "@/lib/rankings-date-range";

function formatDisplayDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getSelectionLabel(selection: RankingsDateRangeSelection): string {
  if (selection.preset === "custom") {
    return `${formatDisplayDate(selection.from)} - ${formatDisplayDate(selection.to)}`;
  }

  return RANKINGS_PRESETS.find((preset) => preset.value === selection.preset)?.label ?? "Last month";
}

export function RankingsDatePicker({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSelection = useMemo(
    () => getRankingsDateRangeFromSearchParams(searchParams),
    [searchParams]
  );
  const [customDraft, setCustomDraft] = useState({
    from: currentSelection.from,
    to: currentSelection.to,
  });
  const [showCustom, setShowCustom] = useState(currentSelection.preset === "custom");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCustomDraft({ from: currentSelection.from, to: currentSelection.to });
    setShowCustom(currentSelection.preset === "custom");
    setError(null);
  }, [currentSelection.from, currentSelection.preset, currentSelection.to]);

  useEffect(() => {
    const hasExplicitParams =
      searchParams.has("days") ||
      (searchParams.has("from") && searchParams.has("to"));
    if (hasExplicitParams) return;

    const stored = parseStoredRankingsDateRange(
      localStorage.getItem(RANKINGS_DATE_RANGE_STORAGE_KEY)
    );
    if (!stored) return;

    const defaults = getDefaultRankingsDateRange();
    if (
      stored.preset === defaults.preset &&
      stored.from === defaults.from &&
      stored.to === defaults.to
    ) {
      return;
    }

    const nextQuery = buildRankingsSearchParams(stored, searchParams);
    startTransition(() => {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    });
  }, [pathname, router, searchParams]);

  const persistAndNavigate = (selection: RankingsDateRangeSelection) => {
    localStorage.setItem(RANKINGS_DATE_RANGE_STORAGE_KEY, JSON.stringify(selection));
    const nextQuery = buildRankingsSearchParams(selection, searchParams);
    startTransition(() => {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    });
  };

  const applyPreset = (preset: Exclude<RankingsDateRangeSelection["preset"], "custom">) => {
    const selection = getPresetRange(preset);
    setShowCustom(false);
    setError(null);
    persistAndNavigate(selection);
  };

  const applyCustom = () => {
    if (!customDraft.from || !customDraft.to) {
      setError("Select both a start and end date.");
      return;
    }

    if (customDraft.from > customDraft.to) {
      setError("Start date must be on or before the end date.");
      return;
    }

    setError(null);
    persistAndNavigate({
      preset: "custom",
      from: customDraft.from,
      to: customDraft.to,
      days: getRangeDaySpan(customDraft.from, customDraft.to),
    });
  };

  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-xl border bg-card/70 p-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {RANKINGS_PRESETS.map((preset) => (
          <Button
            key={preset.value}
            variant={currentSelection.preset === preset.value ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset(preset.value)}
          >
            {preset.label}
          </Button>
        ))}
        <Button
          variant={currentSelection.preset === "custom" || showCustom ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setShowCustom((value) => !value || currentSelection.preset !== "custom");
            setError(null);
          }}
        >
          <CalendarRange className="size-4" />
          Custom range
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Selected range:</span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          {getSelectionLabel(currentSelection)}
        </span>
        <span className="text-xs text-muted-foreground">
          Applies to Category Rankings and Keyword Rankings.
        </span>
      </div>

      {showCustom && (
        <div className="flex flex-col gap-2 md:flex-row md:items-end">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            From
            <Input
              type="date"
              value={customDraft.from}
              onChange={(event) => setCustomDraft((current) => ({ ...current, from: event.target.value }))}
              className="h-9 w-full md:w-[180px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            To
            <Input
              type="date"
              value={customDraft.to}
              onChange={(event) => setCustomDraft((current) => ({ ...current, to: event.target.value }))}
              className="h-9 w-full md:w-[180px]"
            />
          </label>
          <Button size="sm" onClick={applyCustom}>
            Apply range
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
