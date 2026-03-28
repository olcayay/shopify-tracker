"use client";

import { cn } from "@/lib/utils";

export const PRESETS = {
  essential: {
    label: "Essential",
    columns: ["app", "visibility", "power", "rating", "price", "momentum"],
  },
  growth: {
    label: "Growth",
    columns: ["app", "reviews", "v7d", "v30d", "v90d", "momentum", "rankedKeywords"],
  },
  content: {
    label: "Content",
    columns: ["app", "lastChange", "changeCount", "descriptionLength", "featuresCount", "categories"],
  },
  full: {
    label: "Full",
    columns: [
      "app", "visibility", "power", "similarity", "rating", "reviews",
      "v7d", "v30d", "v90d", "momentum", "price", "minPaidPrice",
      "launchedDate", "featured", "adKeywords", "rankedKeywords",
      "similarApps", "categoryRank", "lastChange",
    ],
  },
} as const;

export type PresetKey = keyof typeof PRESETS;

export function CompetitorPresets({
  active,
  onChange,
}: {
  active: PresetKey;
  onChange: (preset: PresetKey) => void;
}) {
  return (
    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted w-fit">
      {(Object.entries(PRESETS) as [PresetKey, (typeof PRESETS)[PresetKey]][]).map(([key, preset]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md transition-colors",
            active === key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
