"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";

export function KeywordsSearchInput({
  query,
  suggestions,
  showSuggestions,
  searchLoading,
  trackedKeywordIds,
  onSearchInput,
  onFocus,
  onAddKeyword,
}: {
  query: string;
  suggestions: any[];
  showSuggestions: boolean;
  searchLoading: boolean;
  trackedKeywordIds: Set<number>;
  onSearchInput: (value: string) => void;
  onFocus: () => void;
  onAddKeyword: (keyword: string) => void;
}) {
  const searchRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={searchRef} className="relative max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search or type a new keyword..."
          value={query}
          onChange={(e) => onSearchInput(e.target.value)}
          onFocus={onFocus}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              onAddKeyword(query.trim());
            }
          }}
          className="pl-9"
        />
      </div>
      {showSuggestions && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
          {suggestions.map((s) => (
            <button
              key={s.id}
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
              onClick={() => {
                if (trackedKeywordIds.has(s.id)) return;
                onAddKeyword(s.keyword);
              }}
            >
              <span>{s.keyword}</span>
              {trackedKeywordIds.has(s.id) ? (
                <span className="text-xs text-muted-foreground">
                  Added
                </span>
              ) : (
                <Plus className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ))}
          {query.trim() &&
            !suggestions.some(
              (s) =>
                s.keyword.toLowerCase() === query.trim().toLowerCase()
            ) && (
              <button
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between border-t"
                onClick={() => onAddKeyword(query.trim())}
              >
                <span>
                  Track &ldquo;{query.trim()}&rdquo; as new keyword
                </span>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
        </div>
      )}
      {!showSuggestions &&
        query.length >= 1 &&
        suggestions.length === 0 &&
        !searchLoading && (
          <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md">
            <button
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
              onClick={() => onAddKeyword(query.trim())}
            >
              <span>
                Track &ldquo;{query.trim()}&rdquo; as new keyword
              </span>
              <Plus className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}
    </div>
  );
}
