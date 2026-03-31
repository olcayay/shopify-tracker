"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/format-utils";

const FIELD_COLORS: Record<string, string> = {
  name: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  appIntroduction: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  appDetails: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
  features: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  seoTitle: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  seoMetaDescription: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  appCardSubtitle: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300",
  pricingPlans: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
};

export interface ChangeEntry {
  appSlug: string;
  appName: string;
  isSelf: boolean;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  detectedAt: string;
}

function groupByPeriod(entries: ChangeEntry[]): { label: string; entries: ChangeEntry[] }[] {
  const now = Date.now();
  const today: ChangeEntry[] = [];
  const thisWeek: ChangeEntry[] = [];
  const thisMonth: ChangeEntry[] = [];
  const earlier: ChangeEntry[] = [];

  for (const e of entries) {
    const age = now - new Date(e.detectedAt).getTime();
    if (age < 24 * 60 * 60 * 1000) today.push(e);
    else if (age < 7 * 24 * 60 * 60 * 1000) thisWeek.push(e);
    else if (age < 30 * 24 * 60 * 60 * 1000) thisMonth.push(e);
    else earlier.push(e);
  }

  const groups: { label: string; entries: ChangeEntry[] }[] = [];
  if (today.length > 0) groups.push({ label: "Today", entries: today });
  if (thisWeek.length > 0) groups.push({ label: "This Week", entries: thisWeek });
  if (thisMonth.length > 0) groups.push({ label: "This Month", entries: thisMonth });
  if (earlier.length > 0) groups.push({ label: "Earlier", entries: earlier });
  return groups;
}

function truncate(text: string | null, maxLen: number): string {
  if (!text) return "—";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "…";
}

export function UnifiedChangeLog({ entries }: { entries: ChangeEntry[] }) {
  const [sourceFilter, setSourceFilter] = useState<"all" | "self" | "competitors">("all");
  const [fieldFilter, setFieldFilter] = useState<string>("all");

  const allFields = useMemo(() => {
    const fields = new Set(entries.map((e) => e.field));
    return [...fields].sort();
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (sourceFilter === "self" && !e.isSelf) return false;
      if (sourceFilter === "competitors" && e.isSelf) return false;
      if (fieldFilter !== "all" && e.field !== fieldFilter) return false;
      return true;
    });
  }, [entries, sourceFilter, fieldFilter]);

  const groups = groupByPeriod(filtered);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted">
          {(["all", "self", "competitors"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setSourceFilter(key)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                sourceFilter === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {key === "all" ? "All" : key === "self" ? "My App" : "Competitors"}
            </button>
          ))}
        </div>

        <select
          value={fieldFilter}
          onChange={(e) => setFieldFilter(e.target.value)}
          className="text-xs border rounded-md px-2 py-1 bg-background"
        >
          <option value="all">All fields</option>
          {allFields.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* Timeline */}
      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No changes match the current filters.</p>
      )}

      {groups.map((group) => (
        <div key={group.label} className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{group.label}</h3>
          <div className="space-y-1">
            {group.entries.map((entry, i) => (
              <div key={`${entry.appSlug}-${entry.field}-${entry.detectedAt}-${i}`} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{entry.appName}</span>
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", FIELD_COLORS[entry.field] || "")}>
                      {entry.field}
                    </Badge>
                    {entry.isSelf && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">You</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    <span className="line-through">{truncate(entry.oldValue, 80)}</span>
                    <span className="mx-1">→</span>
                    <span>{truncate(entry.newValue, 80)}</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatShortDate(entry.detectedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
