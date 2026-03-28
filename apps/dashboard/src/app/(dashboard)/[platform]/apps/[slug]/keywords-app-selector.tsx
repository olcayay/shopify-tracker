"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AppIcon } from "./keywords-app-icon";
import type { SimpleApp } from "./keywords-section-types";

export function KeywordsAppSelector({
  mainApp,
  competitors,
  selectedSlugs,
  dragIndex,
  dragOverIndex,
  onToggleCompetitor,
  onToggleAll,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  mainApp: SimpleApp | null;
  competitors: SimpleApp[];
  selectedSlugs: Set<string>;
  dragIndex: number | null;
  dragOverIndex: number | null;
  onToggleCompetitor: (slug: string) => void;
  onToggleAll: () => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (targetIndex: number) => void;
  onDragEnd: () => void;
}) {
  if (competitors.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 flex-wrap pb-4">
          {mainApp && (
            <AppIcon app={mainApp} selected isMain />
          )}
          <div className="w-px h-8 bg-border" />
          {competitors.map((c, idx) => (
            <div
              key={c.slug}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDrop={() => onDrop(idx)}
              onDragEnd={onDragEnd}
              className={cn(
                "relative cursor-grab active:cursor-grabbing transition-all",
                dragIndex === idx && "opacity-30",
                dragOverIndex === idx && dragIndex !== idx && "scale-110"
              )}
            >
              {dragOverIndex === idx && dragIndex !== null && dragIndex !== idx && (
                <div className={cn(
                  "absolute top-0 bottom-0 w-0.5 bg-emerald-500 z-10",
                  dragIndex > idx ? "-left-1.5" : "-right-1.5"
                )} />
              )}
              <AppIcon
                app={c}
                selected={selectedSlugs.has(c.slug)}
                onClick={() => onToggleCompetitor(c.slug)}
              />
            </div>
          ))}
          <button
            onClick={onToggleAll}
            className="text-xs text-muted-foreground hover:text-foreground ml-2 transition-colors"
          >
            {selectedSlugs.size === competitors.length ? "Deselect all" : "Select all"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
