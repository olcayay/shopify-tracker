"use client";

import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Minus } from "lucide-react";

const GRID_THRESHOLD = 12;
const PLURALS: Record<string, string> = { category: "categories" };
function pluralize(label: string, count: number): string {
  if (count === 1) return label;
  return PLURALS[label] ?? `${label}s`;
}

export interface RankingTooltipRow {
  label: string;
  color: string;
  position: number | null;
  previousPosition: number | null;
}

export type TierKey = "top3" | "top10" | "top50" | "beyond" | "dropped";

export interface TierGroup {
  key: TierKey;
  title: string;
  rows: RankingTooltipRow[];
  defaultCollapsed: boolean;
}

const TIER_TITLES: Record<TierKey, string> = {
  top3: "Top 3",
  top10: "Top 10",
  top50: "Top 50",
  beyond: "Beyond 50",
  dropped: "Dropped / No rank",
};

/** Assign a tier by position. Null position => "dropped". */
export function tierFor(position: number | null): TierKey {
  if (position == null || position <= 0) return "dropped";
  if (position <= 3) return "top3";
  if (position <= 10) return "top10";
  if (position <= 50) return "top50";
  return "beyond";
}

/**
 * Build grouped + sorted tooltip rows for a given hovered date.
 *
 * @param payload - recharts Tooltip payload (one entry per series/line)
 * @param pivotedData - the same `pivoted` rows the chart renders; used to look
 *   up the previous point's position for each label.
 * @param labels - the canonical label list (same order as the chart)
 * @param colorMap - label → color (reuse the chart's colorMap)
 * @param hiddenLabels - labels the user toggled off; they are filtered out.
 */
export function buildTooltipGroups(
  payload: Array<{ dataKey?: string | number; value?: number | null }> | undefined,
  pivotedData: Array<Record<string, unknown>>,
  labels: string[],
  colorMap: Map<string, string>,
  hiddenLabels: Set<string>,
  hoveredDate: string | number | undefined,
): TierGroup[] {
  if (!payload || payload.length === 0 || hoveredDate == null) return [];

  const dateIndex = pivotedData.findIndex((row) => row.date === hoveredDate);
  if (dateIndex < 0) return [];

  const previousRow = dateIndex > 0 ? pivotedData[dateIndex - 1] : null;

  const payloadByLabel = new Map<string, number | null>();
  for (const entry of payload) {
    if (typeof entry.dataKey !== "string") continue;
    payloadByLabel.set(entry.dataKey, (entry.value ?? null) as number | null);
  }

  const rows: RankingTooltipRow[] = [];
  for (const label of labels) {
    if (hiddenLabels.has(label)) continue;
    if (!payloadByLabel.has(label)) continue;
    const position = payloadByLabel.get(label) ?? null;
    const prev = previousRow ? (previousRow[label] as number | null | undefined) ?? null : null;
    rows.push({
      label,
      color: colorMap.get(label) ?? "currentColor",
      position,
      previousPosition: prev,
    });
  }

  const buckets: Record<TierKey, RankingTooltipRow[]> = {
    top3: [],
    top10: [],
    top50: [],
    beyond: [],
    dropped: [],
  };
  for (const row of rows) {
    buckets[tierFor(row.position)].push(row);
  }
  for (const key of Object.keys(buckets) as TierKey[]) {
    buckets[key].sort((a, b) => {
      const ap = a.position ?? Number.POSITIVE_INFINITY;
      const bp = b.position ?? Number.POSITIVE_INFINITY;
      if (ap !== bp) return ap - bp;
      return a.label.localeCompare(b.label);
    });
  }

  const groups: TierGroup[] = [
    { key: "top3", title: TIER_TITLES.top3, rows: buckets.top3, defaultCollapsed: false },
    { key: "top10", title: TIER_TITLES.top10, rows: buckets.top10, defaultCollapsed: false },
    { key: "top50", title: TIER_TITLES.top50, rows: buckets.top50, defaultCollapsed: false },
    { key: "beyond", title: TIER_TITLES.beyond, rows: buckets.beyond, defaultCollapsed: true },
    { key: "dropped", title: TIER_TITLES.dropped, rows: buckets.dropped, defaultCollapsed: true },
  ];
  return groups.filter((g) => g.rows.length > 0);
}

interface ChangeDisplay {
  kind: "up" | "down" | "same" | "new" | "lost";
  value?: number;
}

export function changeFor(row: RankingTooltipRow): ChangeDisplay {
  const cur = row.position;
  const prev = row.previousPosition;
  if (cur == null && prev != null) return { kind: "lost" };
  if (cur != null && prev == null) return { kind: "new" };
  if (cur == null || prev == null) return { kind: "same" };
  const diff = prev - cur;
  if (diff === 0) return { kind: "same" };
  return { kind: diff > 0 ? "up" : "down", value: Math.abs(diff) };
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number | null }>;
  label?: string | number;
  pivotedData: Array<Record<string, unknown>>;
  labels: string[];
  colorMap: Map<string, string>;
  hiddenLabels: Set<string>;
  /** Noun for the items being ranked. Defaults to "keyword". */
  itemLabel?: string;
}

export function RankingChartTooltip({
  active,
  payload,
  label,
  pivotedData,
  labels,
  colorMap,
  hiddenLabels,
  itemLabel = "keyword",
}: TooltipProps) {
  const liveGroups = useMemo(
    () => buildTooltipGroups(payload, pivotedData, labels, colorMap, hiddenLabels, label),
    [payload, pivotedData, labels, colorMap, hiddenLabels, label],
  );

  const [expanded, setExpanded] = useState<Partial<Record<TierKey, boolean>>>({});
  // Freeze the groups + header label while the user's cursor is inside the
  // tooltip. Without this, moving the mouse over the tooltip body drags
  // recharts' x-cursor to the next day and the content re-renders under the
  // pointer, making long lists unreachable. Using state (not a ref) keeps
  // this safe under strict-mode / React compiler lint rules.
  const [frozen, setFrozen] = useState<{ groups: TierGroup[]; label: string | number | undefined } | null>(null);

  const groups = frozen ? frozen.groups : liveGroups;
  const displayLabel = frozen ? frozen.label : label;
  const pinned = frozen !== null;

  // Clamp the tooltip so its bottom never falls past the viewport. Recharts
  // anchors the wrapper at the chart top; on tall lists the inner card
  // would otherwise stretch past the visible area and the scroll handle
  // sat off-screen.
  const cardRef = useRef<HTMLDivElement>(null);
  const [maxHeightPx, setMaxHeightPx] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const node = cardRef.current;
    if (!node) return;
    const top = node.getBoundingClientRect().top;
    setMaxHeightPx(Math.max(160, window.innerHeight - top - 16));
  }, [groups, displayLabel]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      const node = cardRef.current;
      if (!node) return;
      const top = node.getBoundingClientRect().top;
      setMaxHeightPx(Math.max(160, window.innerHeight - top - 16));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!pinned && (!active || groups.length === 0)) return null;
  if (pinned && groups.length === 0) return null;

  // Flat list mode: ≤5 visible keywords and at most one tier used.
  const totalVisible = groups.reduce((n, g) => n + g.rows.length, 0);
  const flatMode = totalVisible <= 5 && groups.length <= 2;

  return (
    <div
      ref={cardRef}
      data-testid="ranking-tooltip"
      onMouseEnter={() => setFrozen({ groups: liveGroups, label })}
      onMouseLeave={() => setFrozen(null)}
      className="rounded-lg border border-border bg-card text-foreground shadow-md text-xs"
      style={{
        width: "min(420px, 95vw)",
        maxHeight: maxHeightPx != null ? `${maxHeightPx}px` : "85vh",
        overflowY: "auto",
      }}
    >
      <div className="sticky top-0 bg-card border-b border-border px-3 py-2 font-medium">
        {String(displayLabel ?? "")}
        <span className="ml-2 text-muted-foreground font-normal">
          {totalVisible} {pluralize(itemLabel, totalVisible)}
        </span>
      </div>

      {flatMode ? (
        <ul className="py-1">
          {groups.flatMap((g) => g.rows).map((row) => (
            <TooltipRow key={row.label} row={row} />
          ))}
        </ul>
      ) : (
        groups.map((group) => {
          const isExpanded = expanded[group.key] ?? !group.defaultCollapsed;
          const useGrid = isExpanded && group.rows.length > GRID_THRESHOLD;
          return (
            <section key={group.key} className="border-b border-border last:border-0">
              <button
                type="button"
                onClick={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [group.key]: !(prev[group.key] ?? !group.defaultCollapsed),
                  }))
                }
                className="sticky top-[33px] z-[1] w-full flex items-center gap-1 bg-muted/60 hover:bg-muted text-left px-3 py-1.5 font-medium"
              >
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span>{group.title}</span>
                <span className="ml-auto text-muted-foreground text-[11px]">{group.rows.length}</span>
              </button>
              {isExpanded && (
                <ul
                  data-testid={useGrid ? `tier-${group.key}-grid` : `tier-${group.key}-list`}
                  className={useGrid ? "grid grid-cols-2 gap-x-1 py-1" : "py-1"}
                >
                  {group.rows.map((row) => (
                    <TooltipRow key={row.label} row={row} />
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

function TooltipRow({ row }: { row: RankingTooltipRow }) {
  const change = changeFor(row);
  return (
    <li className="flex items-center gap-2 px-3 py-1 leading-tight">
      <span
        className="inline-block h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: row.color }}
        aria-hidden="true"
      />
      <span className="font-semibold w-8 text-right tabular-nums">
        {row.position == null ? "—" : `#${row.position}`}
      </span>
      <ChangeBadge change={change} />
      <span className="flex-1 truncate text-muted-foreground" title={row.label}>
        {row.label}
      </span>
    </li>
  );
}

function ChangeBadge({ change }: { change: ChangeDisplay }) {
  if (change.kind === "up") {
    return (
      <span className="inline-flex items-center gap-0.5 w-10 text-green-600 dark:text-green-400 tabular-nums">
        <ArrowUp className="h-3 w-3" />+{change.value}
      </span>
    );
  }
  if (change.kind === "down") {
    return (
      <span className="inline-flex items-center gap-0.5 w-10 text-red-500 dark:text-red-400 tabular-nums">
        <ArrowDown className="h-3 w-3" />−{change.value}
      </span>
    );
  }
  if (change.kind === "new") {
    return <span className="inline-flex w-10 justify-center text-blue-600 dark:text-blue-400">new</span>;
  }
  if (change.kind === "lost") {
    return <span className="inline-flex w-10 justify-center text-red-500 dark:text-red-400">lost</span>;
  }
  return (
    <span className="inline-flex w-10 justify-center text-muted-foreground" aria-label="no change">
      <Minus className="h-3 w-3" />
    </span>
  );
}
