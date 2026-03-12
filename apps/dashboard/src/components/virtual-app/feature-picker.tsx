"use client";

import { useState, useMemo } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CompetitorCountBadge } from "./competitor-count-badge";

interface Props {
  competitors: { name: string; features: string[] }[];
  selectedFeatures: string[];
  onAdd: (feature: string) => void;
  onRemove: (feature: string) => void;
  disabled?: boolean;
}

export function FeaturePicker({
  competitors, selectedFeatures, onAdd, onRemove, disabled,
}: Props) {
  const [customFeature, setCustomFeature] = useState("");
  const [search, setSearch] = useState("");

  const selectedSet = useMemo(() => new Set(selectedFeatures), [selectedFeatures]);
  const totalCompetitors = competitors.length;

  // Build feature list with counts and competitor names, sorted by count desc
  const featuresWithCounts = useMemo(() => {
    const map = new Map<string, { count: number; names: string[] }>();
    for (const comp of competitors) {
      for (const f of comp.features || []) {
        if (!map.has(f)) map.set(f, { count: 0, names: [] });
        const entry = map.get(f)!;
        if (!entry.names.includes(comp.name)) {
          entry.count++;
          entry.names.push(comp.name);
        }
      }
    }
    return Array.from(map.entries())
      .map(([feature, { count, names }]) => ({ feature, count, names }))
      .sort((a, b) => b.count - a.count || a.feature.localeCompare(b.feature));
  }, [competitors]);

  const competitorFeatureSet = useMemo(
    () => new Set(featuresWithCounts.map((f) => f.feature)),
    [featuresWithCounts]
  );

  // Custom features = selected features not in competitor pool
  const customFeatures = useMemo(
    () => selectedFeatures.filter((f) => !competitorFeatureSet.has(f)),
    [selectedFeatures, competitorFeatureSet]
  );

  const filtered = useMemo(() => {
    let list = featuresWithCounts;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.feature.toLowerCase().includes(q));
    }
    // Selected items first
    return [...list].sort((a, b) => {
      const aSelected = selectedSet.has(a.feature) ? 0 : 1;
      const bSelected = selectedSet.has(b.feature) ? 0 : 1;
      if (aSelected !== bSelected) return aSelected - bSelected;
      return b.count - a.count || a.feature.localeCompare(b.feature);
    });
  }, [featuresWithCounts, search, selectedSet]);

  function handleAddCustom() {
    const f = customFeature.trim();
    if (!f || selectedSet.has(f)) return;
    onAdd(f);
    setCustomFeature("");
  }

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter features..."
        className="h-8 text-sm"
      />

      <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
        <p className="text-xs text-muted-foreground font-medium px-1 mb-1">
          From competitors ({totalCompetitors}):
        </p>
        {filtered.map(({ feature: feat, count, names }) => {
          const isSelected = selectedSet.has(feat);
          return (
            <button
              key={feat}
              onClick={() => {
                if (disabled) return;
                if (isSelected) onRemove(feat);
                else onAdd(feat);
              }}
              disabled={disabled}
              className={cn(
                "flex items-center gap-2 w-full text-left py-1 px-2 rounded text-sm transition-colors",
                isSelected ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300" : "hover:bg-muted/50"
              )}
            >
              <div className={cn(
                "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                isSelected ? "bg-blue-600 border-blue-600" : "border-muted-foreground/30"
              )}>
                {isSelected && <Check className="h-3 w-3 text-white" />}
              </div>
              <span className="truncate">{feat}</span>
              <CompetitorCountBadge count={count} total={totalCompetitors} names={names} className="ml-auto" />
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground italic px-2 py-1">No matching features</p>
        )}
      </div>

      {customFeatures.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground font-medium px-1 mb-1">Custom:</p>
          <div className="flex flex-wrap gap-1.5">
            {customFeatures.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs"
              >
                {f}
                <button onClick={() => onRemove(f)} disabled={disabled} className="hover:text-red-600">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={customFeature}
          onChange={(e) => setCustomFeature(e.target.value)}
          placeholder="Add custom feature..."
          className="h-8 text-sm flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
        />
        <Button size="sm" variant="secondary" onClick={handleAddCustom} disabled={disabled || !customFeature.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
