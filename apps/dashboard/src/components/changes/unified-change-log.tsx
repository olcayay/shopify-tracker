"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Minus, ChevronsDownUp, ChevronsUpDown, ChevronLeft, List, CalendarDays } from "lucide-react";
import { ChangeHeatmap } from "@/components/changes/change-heatmap";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/format-utils";
import { diffWords, diffArraySummary, type DiffSegment } from "@/lib/text-diff";
import { diffPricingPlans, formatPlanPrice } from "@/lib/pricing-diff";
import { getFieldLabels, hasSeoTitle } from "@appranks/shared";
import type { PricingPlan } from "@appranks/shared";

const PAGE_SIZE = 20;

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

const LONG_TEXT_FIELDS = new Set(["appDetails", "appIntroduction", "seoMetaDescription"]);
const SHORT_TEXT_FIELDS = new Set(["name", "seoTitle", "appCardSubtitle"]);
const ARRAY_FIELDS = new Set(["features"]);

export interface ChangeEntry {
  appSlug: string;
  appName: string;
  isSelf: boolean;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  detectedAt: string;
}

interface Props {
  entries: ChangeEntry[];
  platform?: string;
  showSourceFilter?: boolean;
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

function tryParseJSON<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Summary badge text for collapsed view */
function getChangeSummary(entry: ChangeEntry): string {
  if (entry.field === "features") {
    const oldArr = tryParseJSON<string[]>(entry.oldValue) || [];
    const newArr = tryParseJSON<string[]>(entry.newValue) || [];
    const { added, removed } = diffArraySummary(oldArr, newArr);
    const parts: string[] = [];
    if (added.length > 0) parts.push(`+${added.length}`);
    if (removed.length > 0) parts.push(`-${removed.length}`);
    return parts.length > 0 ? parts.join(", ") + " features" : "Features reordered";
  }

  if (entry.field === "pricingPlans") {
    const oldPlans = tryParseJSON<PricingPlan[]>(entry.oldValue) || [];
    const newPlans = tryParseJSON<PricingPlan[]>(entry.newValue) || [];
    const diff = diffPricingPlans(oldPlans, newPlans);
    const parts: string[] = [];
    if (diff.added.length > 0) parts.push(`+${diff.added.length} plan${diff.added.length > 1 ? "s" : ""}`);
    if (diff.removed.length > 0) parts.push(`-${diff.removed.length} plan${diff.removed.length > 1 ? "s" : ""}`);
    if (diff.modified.length > 0) parts.push(`${diff.modified.length} modified`);
    return parts.join(", ") || "Plans updated";
  }

  if (!entry.oldValue) return "Added";
  if (!entry.newValue) return "Removed";
  return "Updated";
}

// ---------------------------------------------------------------------------
// Change Renderers
// ---------------------------------------------------------------------------

function ArrayDiffRenderer({ oldValue, newValue }: { oldValue: string | null; newValue: string | null }) {
  const oldArr = tryParseJSON<string[]>(oldValue) || [];
  const newArr = tryParseJSON<string[]>(newValue) || [];
  const { added, removed } = diffArraySummary(oldArr, newArr);

  if (added.length === 0 && removed.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Order changed (same items)</p>;
  }

  return (
    <div className="space-y-0.5 font-mono text-xs">
      {removed.map((item, i) => (
        <div key={`r-${i}`} className="flex items-start gap-1.5 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border-l-2 border-red-500 pl-2 py-0.5 rounded-r">
          <Minus className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="line-through">{item}</span>
        </div>
      ))}
      {added.map((item, i) => (
        <div key={`a-${i}`} className="flex items-start gap-1.5 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 border-l-2 border-green-500 pl-2 py-0.5 rounded-r">
          <Plus className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function PricingDiffRenderer({ oldValue, newValue }: { oldValue: string | null; newValue: string | null }) {
  const oldPlans = tryParseJSON<PricingPlan[]>(oldValue) || [];
  const newPlans = tryParseJSON<PricingPlan[]>(newValue) || [];
  const diff = diffPricingPlans(oldPlans, newPlans);

  if (diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Plans reordered (no content changes)</p>;
  }

  return (
    <div className="space-y-1.5 text-xs">
      {diff.removed.map((plan, i) => (
        <div key={`r-${i}`} className="bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border-l-2 border-red-500 pl-2 py-1 rounded-r">
          <span className="font-medium line-through">{plan.name}</span>
          <span className="ml-2 text-red-600 dark:text-red-400">{formatPlanPrice(plan)}</span>
        </div>
      ))}
      {diff.added.map((plan, i) => (
        <div key={`a-${i}`} className="bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 border-l-2 border-green-500 pl-2 py-1 rounded-r">
          <span className="font-medium">{plan.name}</span>
          <span className="ml-2 text-green-600 dark:text-green-400">{formatPlanPrice(plan)}</span>
        </div>
      ))}
      {diff.modified.map((mod, i) => (
        <div key={`m-${i}`} className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-l-2 border-amber-500 pl-2 py-1 rounded-r">
          <span className="font-medium">{mod.name}</span>
          <ul className="mt-0.5 space-y-0.5 list-disc list-inside text-amber-700 dark:text-amber-300/80">
            {mod.changes.map((change, j) => (
              <li key={j}>{change}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function WordDiffRenderer({ oldValue, newValue }: { oldValue: string | null; newValue: string | null }) {
  const segments = useMemo(
    () => diffWords(oldValue || "", newValue || ""),
    [oldValue, newValue]
  );

  return (
    <div className="text-xs leading-relaxed whitespace-pre-wrap">
      {segments.map((seg, i) => (
        <DiffSpan key={i} segment={seg} />
      ))}
    </div>
  );
}

function DiffSpan({ segment }: { segment: DiffSegment }) {
  if (segment.type === "equal") {
    return <span>{segment.text}</span>;
  }
  if (segment.type === "added") {
    return <span className="bg-green-200/60 dark:bg-green-800/40 text-green-900 dark:text-green-200">{segment.text}</span>;
  }
  return <span className="bg-red-200/60 dark:bg-red-800/40 text-red-900 dark:text-red-200 line-through">{segment.text}</span>;
}

function ShortTextRenderer({ oldValue, newValue }: { oldValue: string | null; newValue: string | null }) {
  return (
    <div className="text-xs">
      {oldValue && (
        <span className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 line-through px-1 py-0.5 rounded">{oldValue}</span>
      )}
      {oldValue && newValue && <span className="mx-1.5 text-muted-foreground">→</span>}
      {newValue && (
        <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-1 py-0.5 rounded">{newValue}</span>
      )}
    </div>
  );
}

function FallbackRenderer({ oldValue, newValue }: { oldValue: string | null; newValue: string | null }) {
  // For unknown fields, use short text style for short values, word diff for longer
  const maxLen = Math.max(oldValue?.length || 0, newValue?.length || 0);
  if (maxLen < 200) {
    return <ShortTextRenderer oldValue={oldValue} newValue={newValue} />;
  }
  return <WordDiffRenderer oldValue={oldValue} newValue={newValue} />;
}

function ChangeRenderer({ entry }: { entry: ChangeEntry }) {
  if (ARRAY_FIELDS.has(entry.field)) {
    // Try parsing as JSON array; fall back to text diff
    const oldArr = tryParseJSON<string[]>(entry.oldValue);
    const newArr = tryParseJSON<string[]>(entry.newValue);
    if (oldArr || newArr) {
      return <ArrayDiffRenderer oldValue={entry.oldValue} newValue={entry.newValue} />;
    }
  }

  if (entry.field === "pricingPlans") {
    const oldPlans = tryParseJSON<PricingPlan[]>(entry.oldValue);
    const newPlans = tryParseJSON<PricingPlan[]>(entry.newValue);
    if (oldPlans || newPlans) {
      return <PricingDiffRenderer oldValue={entry.oldValue} newValue={entry.newValue} />;
    }
  }

  if (LONG_TEXT_FIELDS.has(entry.field)) {
    return <WordDiffRenderer oldValue={entry.oldValue} newValue={entry.newValue} />;
  }

  if (SHORT_TEXT_FIELDS.has(entry.field)) {
    return <ShortTextRenderer oldValue={entry.oldValue} newValue={entry.newValue} />;
  }

  return <FallbackRenderer oldValue={entry.oldValue} newValue={entry.newValue} />;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function UnifiedChangeLog({ entries: rawEntries, platform, showSourceFilter = true }: Props) {
  const platformId = platform || "shopify";
  const showSeoTitle = hasSeoTitle(platformId);
  const entries = useMemo(
    () => showSeoTitle ? rawEntries : rawEntries.filter((e) => e.field !== "seoTitle"),
    [rawEntries, showSeoTitle]
  );
  const pathname = usePathname();
  const appLinkPrefix = pathname.includes("/v2/")
    ? `/${platformId}/apps/v2`
    : `/${platformId}/apps`;
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [sourceFilter, setSourceFilter] = useState<"all" | "self" | "competitors">("all");
  const [fieldFilter, setFieldFilter] = useState<string>("all");
  const [appFilter, setAppFilter] = useState<string>("all");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  const fieldLabels = useMemo(
    () => getFieldLabels(platform || "shopify"),
    [platform]
  );

  function getFieldLabel(field: string): string {
    if (field in fieldLabels) {
      return fieldLabels[field as keyof typeof fieldLabels];
    }
    return field;
  }

  const allFields = useMemo(() => {
    const fields = new Set(entries.map((e) => e.field));
    return [...fields].sort();
  }, [entries]);

  const allApps = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of entries) {
      if (!seen.has(e.appSlug)) seen.set(e.appSlug, e.appName);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (sourceFilter === "self" && !e.isSelf) return false;
      if (sourceFilter === "competitors" && e.isSelf) return false;
      if (fieldFilter !== "all" && e.field !== fieldFilter) return false;
      if (appFilter !== "all" && e.appSlug !== appFilter) return false;
      return true;
    });
  }, [entries, sourceFilter, fieldFilter, appFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEntries = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const groups = groupByPeriod(paginatedEntries);

  // Reset page when filters change
  const handleSourceFilter = (key: "all" | "self" | "competitors") => {
    setSourceFilter(key);
    setCurrentPage(1);
  };
  const handleFieldFilter = (value: string) => {
    setFieldFilter(value);
    setCurrentPage(1);
  };
  const handleAppFilter = (value: string) => {
    setAppFilter(value);
    setCurrentPage(1);
  };

  function toggleExpand(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allExpanded = collapsedIds.size === 0;

  function toggleExpandAll() {
    if (allExpanded) {
      // Collapse all visible entries
      const allIds = new Set<string>();
      groups.forEach((group) =>
        group.entries.forEach((entry, i) => {
          allIds.add(`${entry.appSlug}-${entry.field}-${entry.detectedAt}-${i}`);
        })
      );
      setCollapsedIds(allIds);
    } else {
      setCollapsedIds(new Set());
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {showSourceFilter && (
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted">
            {(["all", "self", "competitors"] as const).map((key) => (
              <button
                key={key}
                onClick={() => handleSourceFilter(key)}
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
        )}

        <select
          value={fieldFilter}
          onChange={(e) => handleFieldFilter(e.target.value)}
          className="text-xs border rounded-md px-2 py-1 bg-background"
        >
          <option value="all">All fields</option>
          {allFields.map((f) => (
            <option key={f} value={f}>{getFieldLabel(f)}</option>
          ))}
        </select>

        {allApps.length > 1 && (
          <select
            value={appFilter}
            onChange={(e) => handleAppFilter(e.target.value)}
            className="text-xs border rounded-md px-2 py-1 bg-background"
          >
            <option value="all">All apps</option>
            {allApps.map(([slug, name]) => (
              <option key={slug} value={slug}>{name}</option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-muted">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1 rounded transition-colors",
                viewMode === "list" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
              title="List view"
              aria-label="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={cn(
                "p-1 rounded transition-colors",
                viewMode === "calendar" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
              title="Calendar view"
              aria-label="Calendar view"
            >
              <CalendarDays className="h-3.5 w-3.5" />
            </button>
          </div>

          {viewMode === "list" && (
            <button
              onClick={toggleExpandAll}
              className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title={allExpanded ? "Collapse All" : "Expand All"}
            >
              {allExpanded
                ? <><ChevronsDownUp className="h-3.5 w-3.5" /> Collapse All</>
                : <><ChevronsUpDown className="h-3.5 w-3.5" /> Expand All</>
              }
            </button>
          )}
        </div>
      </div>

      {/* Calendar view */}
      {viewMode === "calendar" && (
        filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No changes match the current filters.</p>
        ) : (
          <ChangeHeatmap entries={filtered} platform={platform} />
        )
      )}

      {/* List view */}
      {viewMode === "list" && (
        <>
          {/* Timeline */}
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No changes match the current filters.</p>
          )}

          {groups.map((group) => (
            <div key={group.label} className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{group.label}</h3>
              <div className="space-y-1">
                {group.entries.map((entry, i) => {
                  const entryId = `${entry.appSlug}-${entry.field}-${entry.detectedAt}-${i}`;
                  const isExpanded = !collapsedIds.has(entryId);

                  return (
                    <div key={entryId} className="rounded-lg border text-sm">
                      {/* Header — always visible, clickable to expand */}
                      <button
                        onClick={() => toggleExpand(entryId)}
                        className="flex items-start gap-3 p-3 w-full text-left hover:bg-muted/30 transition-colors"
                      >
                        <div className="mt-0.5">
                          {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`${appLinkPrefix}/${entry.appSlug}`}
                              className="font-medium hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {entry.appName}
                            </Link>
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", FIELD_COLORS[entry.field] || "")}>
                              {getFieldLabel(entry.field)}
                            </Badge>
                            {entry.isSelf && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">You</Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {getChangeSummary(entry)}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatShortDate(entry.detectedAt)}
                        </span>
                      </button>

                      {/* Expanded content — type-aware diff */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pl-10">
                          <ChangeRenderer entry={entry} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                {filtered.length} changes — page {safePage} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="flex items-center gap-1 px-2 py-1 text-xs border rounded-md disabled:opacity-40 hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="h-3 w-3" /> Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="flex items-center gap-1 px-2 py-1 text-xs border rounded-md disabled:opacity-40 hover:bg-muted transition-colors"
                >
                  Next <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
