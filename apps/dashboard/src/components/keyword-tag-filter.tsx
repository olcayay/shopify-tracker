"use client";

import { getTagColorClasses } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

interface KeywordTag {
  id: string;
  name: string;
  color: string;
}

interface KeywordTagFilterProps {
  tags: KeywordTag[];
  activeTags: Set<string>;
  onToggle: (tagId: string) => void;
  onClearAll: () => void;
}

export function KeywordTagFilter({
  tags,
  activeTags,
  onToggle,
  onClearAll,
}: KeywordTagFilterProps) {
  if (tags.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={onClearAll}
        className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
          activeTags.size === 0
            ? "bg-primary text-primary-foreground"
            : "border border-input hover:bg-accent text-muted-foreground"
        )}
      >
        All
      </button>
      {tags.map((tag) => {
        const colors = getTagColorClasses(tag.color);
        const isActive = activeTags.has(tag.id);
        return (
          <button
            key={tag.id}
            onClick={() => onToggle(tag.id)}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border",
              isActive
                ? `${colors.bg} ${colors.text} ${colors.border}`
                : "border-input text-muted-foreground hover:bg-accent opacity-60 hover:opacity-100"
            )}
          >
            <span
              className={cn("inline-block h-2 w-2 rounded-full mr-1", colors.dot)}
            />
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}
