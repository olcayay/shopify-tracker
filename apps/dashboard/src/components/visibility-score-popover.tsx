"use client";

import * as React from "react";
import { Popover } from "radix-ui";
import { Eye } from "lucide-react";
import { formatNumber } from "@/lib/format-utils";

export function VisibilityScorePopover({
  visibilityScore,
  keywordCount,
  visibilityRaw,
  children,
}: {
  visibilityScore: number;
  keywordCount: number;
  visibilityRaw: number;
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
          className="z-50 w-80 rounded-lg border bg-popover p-4 shadow-lg animate-in fade-in-0 zoom-in-95 text-popover-foreground"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-blue-500" />
              Visibility Score
            </h4>
            <span
              className={`inline-flex items-center justify-center h-7 min-w-[2.5rem] px-2 rounded-full text-sm font-bold tabular-nums ${
                visibilityScore >= 60
                  ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                  : visibilityScore >= 30
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                    : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
              }`}
            >
              {visibilityScore}
            </span>
          </div>

          {/* Step-by-step explanation */}
          <div className="space-y-2.5 text-xs">
            {/* Step 1 */}
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[10px] font-bold mt-0.5">1</span>
              <div>
                <p className="font-medium">Ranked on {keywordCount} keyword{keywordCount !== 1 ? "s" : ""}</p>
                <p className="text-muted-foreground">Each tracked keyword where this app appears in results</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[10px] font-bold mt-0.5">2</span>
              <div>
                <p className="font-medium">Contribution = total results &times; rank weight</p>
                <p className="text-muted-foreground">Higher rank → higher weight, more results → more value</p>
              </div>
            </div>

            {/* Step 3 — Rank weight */}
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[10px] font-bold mt-0.5">3</span>
              <div>
                <p className="font-medium">Rank weight = 1/log&#8322;(rank+1)</p>
                <div className="mt-1 grid grid-cols-3 gap-x-3 gap-y-0.5 text-muted-foreground">
                  <span>Rank 1 → 100%</span>
                  <span>Rank 3 → 50%</span>
                  <span>Rank 5 → 39%</span>
                  <span>Rank 10 → 29%</span>
                  <span>Rank 24 → 21%</span>
                  <span>Rank 50 → 18%</span>
                </div>
              </div>
            </div>

            {/* Step 4 — Page penalty */}
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[10px] font-bold mt-0.5">4</span>
              <div>
                <p className="font-medium">Page penalty: 70% drop per page</p>
                <div className="mt-1 flex gap-3 text-muted-foreground">
                  <span>Page 1 → 100%</span>
                  <span>Page 2 → 30%</span>
                  <span>Page 3 → 9%</span>
                </div>
              </div>
            </div>

            {/* Step 5 — Raw score */}
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[10px] font-bold mt-0.5">5</span>
              <div>
                <p className="font-medium">
                  Raw score: {formatNumber(visibilityRaw, { decimals: 1 })}
                </p>
                <p className="text-muted-foreground">Sum of all keyword contributions</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-[10px] text-muted-foreground/70 border-t pt-2 mt-3">
            Normalized to 0-100 relative to the most visible app
          </p>

          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
