"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompetitorCountBadge } from "@/components/virtual-app/competitor-count-badge";

// ─── Language Picker ────────────────────────────────────────

export function LanguagePicker({
  competitorLanguages,
  totalCompetitors,
  selectedLanguages,
  onToggle,
  onAddCustom,
  disabled,
}: {
  competitorLanguages: { lang: string; count: number; names: string[] }[];
  totalCompetitors: number;
  selectedLanguages: string[];
  onToggle: (lang: string) => void;
  onAddCustom: (lang: string) => void;
  disabled?: boolean;
}) {
  const [customLang, setCustomLang] = useState("");
  const [search, setSearch] = useState("");

  const selectedSet = new Set(selectedLanguages);
  const competitorLangSet = new Set(competitorLanguages.map((l) => l.lang));
  const customLanguages = selectedLanguages.filter((l) => !competitorLangSet.has(l));

  const filtered = (() => {
    let list = competitorLanguages;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) => l.lang.toLowerCase().includes(q));
    }
    // Selected items first
    return [...list].sort((a, b) => {
      const aSelected = selectedSet.has(a.lang) ? 0 : 1;
      const bSelected = selectedSet.has(b.lang) ? 0 : 1;
      if (aSelected !== bSelected) return aSelected - bSelected;
      return b.count - a.count || a.lang.localeCompare(b.lang);
    });
  })();

  function handleAddCustom() {
    const l = customLang.trim();
    if (!l || selectedSet.has(l)) return;
    onAddCustom(l);
    setCustomLang("");
  }

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter languages..."
        className="h-8 text-sm"
      />

      <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
        <p className="text-xs text-muted-foreground font-medium px-1 mb-1">
          From competitors ({totalCompetitors}):
        </p>
        {filtered.map(({ lang, count, names }) => {
          const isSelected = selectedSet.has(lang);
          return (
            <button
              key={lang}
              onClick={() => { if (!disabled) onToggle(lang); }}
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
              <span className="truncate">{lang}</span>
              <CompetitorCountBadge count={count} total={totalCompetitors} names={names} className="ml-auto" />
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground italic px-2 py-1">No matching languages</p>
        )}
      </div>

      {customLanguages.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground font-medium px-1 mb-1">Custom:</p>
          <div className="flex flex-wrap gap-1.5">
            {customLanguages.map((l) => (
              <span
                key={l}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs"
              >
                {l}
                <button onClick={() => onToggle(l)} disabled={disabled} className="hover:text-red-600">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={customLang}
          onChange={(e) => setCustomLang(e.target.value)}
          placeholder="Add custom language..."
          className="h-8 text-sm flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
        />
        <Button size="sm" variant="secondary" onClick={handleAddCustom} disabled={disabled || !customLang.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
