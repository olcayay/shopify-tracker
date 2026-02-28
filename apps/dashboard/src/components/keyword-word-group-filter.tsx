"use client";

import { cn } from "@/lib/utils";
import type { WordGroup } from "@/lib/keyword-word-groups";

interface KeywordWordGroupFilterProps {
  wordGroups: WordGroup[];
  activeWord: string | null;
  onSelect: (word: string | null) => void;
}

export function KeywordWordGroupFilter({
  wordGroups,
  activeWord,
  onSelect,
}: KeywordWordGroupFilterProps) {
  if (wordGroups.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-muted-foreground mr-1">Common words:</span>
      {wordGroups.map((group) => {
        const isActive = activeWord === group.word;
        return (
          <button
            key={group.word}
            onClick={() => onSelect(isActive ? null : group.word)}
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium transition-colors border",
              isActive
                ? "bg-muted border-foreground/50 text-foreground"
                : "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground"
            )}
          >
            {group.word}
            <span
              className={cn(
                "ml-1 text-[10px]",
                isActive ? "text-foreground/70" : "text-muted-foreground/60"
              )}
            >
              {group.count}
            </span>
          </button>
        );
      })}
      {activeWord && (
        <button
          onClick={() => onSelect(null)}
          className="text-xs text-muted-foreground hover:text-foreground ml-1"
        >
          Clear
        </button>
      )}
    </div>
  );
}
