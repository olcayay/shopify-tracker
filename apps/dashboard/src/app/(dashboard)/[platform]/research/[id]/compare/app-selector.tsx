"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppData } from "./types";

export function AppSelector({
  virtualAppSlugs,
  competitorSlugs,
  appDataMap,
  selectedSlugs,
  setSelectedSlugs,
  allSlugs,
}: {
  virtualAppSlugs: string[];
  competitorSlugs: string[];
  appDataMap: Map<string, AppData>;
  selectedSlugs: Set<string>;
  setSelectedSlugs: React.Dispatch<React.SetStateAction<Set<string>>>;
  allSlugs: string[];
}) {
  function toggleSlug(slug: string) {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Virtual apps first */}
          {virtualAppSlugs.map((slug) => {
            const app = appDataMap.get(slug);
            if (!app) return null;
            const isSelected = selectedSlugs.has(slug);
            const color = app.color || "#3B82F6";
            return (
              <div key={slug} className="flex flex-col items-center gap-1">
                <button
                  onClick={() => toggleSlug(slug)}
                  className={cn(
                    "relative rounded-lg transition-all shrink-0 h-10 w-10",
                    isSelected
                      ? "ring-2 ring-offset-2 ring-offset-background"
                      : "opacity-35 hover:opacity-60"
                  )}
                  style={isSelected ? { ["--tw-ring-color" as any]: color } : undefined}
                >
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    <span className="text-lg">{app.icon || "🚀"}</span>
                  </div>
                  {isSelected && (
                    <div
                      className="absolute -top-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: color }}
                    >
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </button>
                <span className="text-[10px] font-medium whitespace-nowrap max-w-[60px] truncate" style={{ color }}>
                  {app.name.split(/[\s\-–—]/)[0]}
                </span>
              </div>
            );
          })}
          {virtualAppSlugs.length > 0 && competitorSlugs.length > 0 && (
            <div className="border-l h-8 mx-1" />
          )}
          {/* Competitors */}
          {competitorSlugs.map((slug) => {
            const app = appDataMap.get(slug);
            if (!app) return null;
            const isSelected = selectedSlugs.has(slug);
            return (
              <div key={slug} className="flex flex-col items-center gap-1">
                <button
                  onClick={() => toggleSlug(slug)}
                  className={cn(
                    "relative rounded-lg transition-all shrink-0 h-10 w-10",
                    isSelected
                      ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background"
                      : "opacity-35 hover:opacity-60 grayscale hover:grayscale-0"
                  )}
                >
                  {app.iconUrl ? (
                    <img src={app.iconUrl} alt={app.name} className="h-10 w-10 rounded-lg" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold">
                      {app.name.charAt(0)}
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </button>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap max-w-[60px] truncate">
                  {app.name.split(/\s/)[0]}
                </span>
              </div>
            );
          })}
          <div className="border-l h-8 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (selectedSlugs.size === allSlugs.length) setSelectedSlugs(new Set());
              else setSelectedSlugs(new Set(allSlugs));
            }}
            className="text-xs"
          >
            {selectedSlugs.size === allSlugs.length ? "Deselect all" : "Select all"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
