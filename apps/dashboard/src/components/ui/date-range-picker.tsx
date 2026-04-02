"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DateRangePreset = "7d" | "30d" | "90d" | "custom";

interface DateRangePickerProps {
  value: { from: string; to: string; preset: DateRangePreset };
  onChange: (range: { from: string; to: string; preset: DateRangePreset }) => void;
  className?: string;
}

const PRESETS: { label: string; value: DateRangePreset; days: number }[] = [
  { label: "7 days", value: "7d", days: 7 },
  { label: "30 days", value: "30d", days: 30 },
  { label: "90 days", value: "90d", days: 90 },
];

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Date range picker with preset buttons (7d, 30d, 90d) and optional custom range.
 * Stores dates as YYYY-MM-DD strings for easy API integration.
 */
export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [showCustom, setShowCustom] = useState(value.preset === "custom");

  const handlePreset = (preset: DateRangePreset, days: number) => {
    setShowCustom(false);
    onChange({ from: daysAgo(days), to: today(), preset });
  };

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {PRESETS.map((p) => (
        <Button
          key={p.value}
          variant={value.preset === p.value ? "default" : "outline"}
          size="sm"
          onClick={() => handlePreset(p.value, p.days)}
        >
          {p.label}
        </Button>
      ))}
      <Button
        variant={showCustom ? "default" : "outline"}
        size="sm"
        onClick={() => setShowCustom(true)}
      >
        <Calendar className="h-3 w-3 mr-1" />
        Custom
      </Button>

      {showCustom && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value, preset: "custom" })}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value, preset: "custom" })}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          />
        </div>
      )}
    </div>
  );
}

/** Helper to initialize default date range state */
export function defaultDateRange(preset: DateRangePreset = "30d"): { from: string; to: string; preset: DateRangePreset } {
  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  return { from: daysAgo(days), to: today(), preset };
}
