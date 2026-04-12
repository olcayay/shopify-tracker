"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Check, ChevronDown } from "lucide-react";
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
    return `${formatDisplayDate(selection.from)} – ${formatDisplayDate(selection.to)}`;
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

  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(currentSelection.preset === "custom");
  const [customDraft, setCustomDraft] = useState({
    from: currentSelection.from,
    to: currentSelection.to,
  });
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCustomDraft({ from: currentSelection.from, to: currentSelection.to });
    setShowCustom(currentSelection.preset === "custom");
    setError(null);
  }, [currentSelection.from, currentSelection.preset, currentSelection.to]);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

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
    setShowCustom(false);
    setError(null);
    setOpen(false);
    persistAndNavigate(getPresetRange(preset));
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
    setOpen(false);
    persistAndNavigate({
      preset: "custom",
      from: customDraft.from,
      to: customDraft.to,
      days: getRangeDaySpan(customDraft.from, customDraft.to),
    });
  };

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="h-9 gap-2 font-normal"
      >
        <Calendar className="size-4 text-muted-foreground" />
        <span>{getSelectionLabel(currentSelection)}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </Button>

      {open && (
        <div
          role="dialog"
          className="absolute right-0 z-20 mt-2 w-72 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <ul className="flex flex-col">
            {RANKINGS_PRESETS.map((preset) => {
              const active = currentSelection.preset === preset.value;
              return (
                <li key={preset.value}>
                  <button
                    type="button"
                    onClick={() => applyPreset(preset.value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                      active && "font-medium"
                    )}
                  >
                    <span>{preset.label}</span>
                    {active && <Check className="size-4" />}
                  </button>
                </li>
              );
            })}
            <li role="separator" className="my-1 h-px bg-border" />
            <li>
              <button
                type="button"
                onClick={() => setShowCustom((value) => !value)}
                aria-expanded={showCustom}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                  currentSelection.preset === "custom" && "font-medium"
                )}
              >
                <span>Custom range…</span>
                {currentSelection.preset === "custom" && !showCustom && <Check className="size-4" />}
              </button>
            </li>
          </ul>

          {showCustom && (
            <div className="border-t px-3 pt-3 pb-2">
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  From
                  <Input
                    type="date"
                    value={customDraft.from}
                    max={customDraft.to || undefined}
                    onChange={(event) =>
                      setCustomDraft((current) => ({ ...current, from: event.target.value }))
                    }
                    className="h-9"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  To
                  <Input
                    type="date"
                    value={customDraft.to}
                    min={customDraft.from || undefined}
                    onChange={(event) =>
                      setCustomDraft((current) => ({ ...current, to: event.target.value }))
                    }
                    className="h-9"
                  />
                </label>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button size="sm" onClick={applyCustom} className="mt-1 w-full">
                  Apply range
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
