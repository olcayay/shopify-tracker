"use client";

import * as React from "react";
import { Popover } from "radix-ui";
import { TrendingUp } from "lucide-react";

function ScoreBar({
  label,
  value,
  weight,
}: {
  label: string;
  value: number;
  weight: number;
}) {
  const pct = Math.min(Math.round(value * 100), 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 60
              ? "bg-green-500"
              : pct >= 30
                ? "bg-amber-500"
                : "bg-red-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right tabular-nums text-muted-foreground">
        {pct}%
      </span>
      <span className="w-8 text-right tabular-nums text-muted-foreground/50 text-[10px]">
        {Math.round(weight * 100)}%
      </span>
    </div>
  );
}

export function PowerScorePopover({
  powerScore,
  ratingScore,
  reviewScore,
  categoryScore,
  momentumScore,
  position,
  totalApps,
  children,
}: {
  powerScore: number;
  ratingScore: number;
  reviewScore: number;
  categoryScore: number;
  momentumScore: number;
  position?: number | null;
  totalApps?: number | null;
  children: React.ReactNode;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="left"
          align="start"
          sideOffset={8}
          className="z-50 w-72 rounded-lg border bg-popover p-4 shadow-lg animate-in fade-in-0 zoom-in-95 text-popover-foreground"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              Power Score
              {position != null && totalApps != null && (
                <span className="text-xs font-normal text-muted-foreground">
                  (#{position}/{totalApps})
                </span>
              )}
            </h4>
            <span
              className={`inline-flex items-center justify-center h-7 min-w-[2.5rem] px-2 rounded-full text-sm font-bold tabular-nums ${
                powerScore >= 60
                  ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                  : powerScore >= 30
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                    : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
              }`}
            >
              {powerScore}
            </span>
          </div>

          {/* Score breakdown */}
          <div className="space-y-1.5 mb-3">
            <ScoreBar label="Rating" value={ratingScore} weight={0.35} />
            <ScoreBar label="Review Auth." value={reviewScore} weight={0.25} />
            <ScoreBar label="Category Rank" value={categoryScore} weight={0.25} />
            <ScoreBar label="Momentum" value={momentumScore} weight={0.15} />
          </div>

          {/* Footer */}
          <p className="text-[10px] text-muted-foreground/70 border-t pt-2">
            Normalized to 0-100 relative to the strongest app in this category
          </p>

          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

interface PowerCategory {
  title: string;
  powerScore: number;
  appCount: number;
  position?: number | null;
  ratingScore: number;
  reviewScore: number;
  categoryScore: number;
  momentumScore: number;
}

export function WeightedPowerPopover({
  weightedPowerScore,
  powerCategories,
  children,
}: {
  weightedPowerScore: number;
  powerCategories: PowerCategory[];
  children: React.ReactNode;
}) {
  const totalAppCount = powerCategories.reduce((sum, c) => sum + c.appCount, 0);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="left"
          align="start"
          sideOffset={8}
          className="z-50 w-80 max-h-[70vh] overflow-y-auto rounded-lg border bg-popover p-4 shadow-lg animate-in fade-in-0 zoom-in-95 text-popover-foreground"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              Weighted Power
            </h4>
            <span
              className={`inline-flex items-center justify-center h-7 min-w-[2.5rem] px-2 rounded-full text-sm font-bold tabular-nums ${
                weightedPowerScore >= 60
                  ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                  : weightedPowerScore >= 30
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                    : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
              }`}
            >
              {weightedPowerScore}
            </span>
          </div>

          {/* Per-category breakdowns */}
          <div className="space-y-3 mb-3">
            {powerCategories.map((cat) => {
              const weightPct = totalAppCount > 0 ? Math.round((cat.appCount / totalAppCount) * 100) : 0;
              return (
                <div key={cat.title} className="space-y-1">
                  {/* Category header */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground truncate flex-1">
                      {cat.title}
                      <span className="text-muted-foreground/60 ml-1">
                        ({cat.position != null ? `#${cat.position}/` : ""}{cat.appCount} apps, {weightPct}%)
                      </span>
                    </span>
                    <span
                      className={`ml-2 text-sm font-bold tabular-nums ${
                        cat.powerScore >= 60
                          ? "text-green-600 dark:text-green-400"
                          : cat.powerScore >= 30
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {cat.powerScore}
                    </span>
                  </div>
                  {/* Score bars */}
                  <div className="space-y-1 pl-1">
                    <ScoreBar label="Rating" value={cat.ratingScore} weight={0.35} />
                    <ScoreBar label="Review Auth." value={cat.reviewScore} weight={0.25} />
                    <ScoreBar label="Category Rank" value={cat.categoryScore} weight={0.25} />
                    <ScoreBar label="Momentum" value={cat.momentumScore} weight={0.15} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <p className="text-[10px] text-muted-foreground/70 border-t pt-2">
            Weighted average: each category&apos;s power score is weighted by its app count
          </p>

          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
