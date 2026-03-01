"use client";

import * as React from "react";
import { Popover } from "radix-ui";
import { Star, Shield, TrendingUp } from "lucide-react";
import type { KeywordOpportunityMetrics } from "@shopify-tracking/shared";

function ScoreBar({ label, value, weight }: { label: string; value: number; weight: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-muted-foreground shrink-0">{label}</span>
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
      <span className="w-8 text-right tabular-nums text-muted-foreground">{pct}%</span>
      <span className="w-8 text-right tabular-nums text-muted-foreground/50 text-[10px]">{Math.round(weight * 100)}%</span>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function KeywordOpportunityPopover({
  metrics,
  children,
}: {
  metrics: KeywordOpportunityMetrics;
  children: React.ReactNode;
}) {
  const { opportunityScore, scores, stats, topApps } = metrics;

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
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Opportunity Score
            </h4>
            <span
              className={`inline-flex items-center justify-center h-7 min-w-[2.5rem] px-2 rounded-full text-sm font-bold tabular-nums ${
                opportunityScore >= 60
                  ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                  : opportunityScore >= 30
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                    : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
              }`}
            >
              {opportunityScore}
            </span>
          </div>

          {/* Score breakdown */}
          <div className="space-y-1.5 mb-4">
            <ScoreBar label="Room" value={scores.room} weight={0.40} />
            <ScoreBar label="Demand" value={scores.demand} weight={0.25} />
            <ScoreBar label="Maturity" value={scores.maturity} weight={0.10} />
            <ScoreBar label="Quality" value={scores.quality} weight={0.25} />
          </div>

          {/* First Page Stats */}
          <div className="border-t pt-3 mb-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">First Page Analysis</p>
            <div className="space-y-1">
              <StatRow label="Total Results" value={stats.totalResults.toLocaleString()} />
              <StatRow label="Organic Apps" value={stats.organicCount} />
              <StatRow
                label="Avg Rating"
                value={stats.firstPageAvgRating != null ? stats.firstPageAvgRating.toFixed(1) : "\u2014"}
              />
              <StatRow label="Built for Shopify" value={stats.bfsCount} />
              <StatRow label="1000+ Reviews" value={stats.count1000} />
              <StatRow label="100+ Reviews" value={stats.count100} />
            </div>
          </div>

          {/* Review concentration */}
          <div className="border-t pt-3 mb-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Review Concentration</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-16 text-muted-foreground shrink-0">Top 1</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.round(stats.top1ReviewShare * 100)}%` }}
                  />
                </div>
                <span className="w-8 text-right tabular-nums text-muted-foreground">
                  {Math.round(stats.top1ReviewShare * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-16 text-muted-foreground shrink-0">Top 4</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-400"
                    style={{ width: `${Math.round(stats.top4ReviewShare * 100)}%` }}
                  />
                </div>
                <span className="w-8 text-right tabular-nums text-muted-foreground">
                  {Math.round(stats.top4ReviewShare * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Top 4 leaders */}
          {topApps.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Top Apps</p>
              <div className="space-y-1.5">
                {topApps.map((app, i) => (
                  <div key={app.slug} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-center text-muted-foreground/60 shrink-0 font-mono">
                      {i + 1}
                    </span>
                    {app.logoUrl ? (
                      <img src={app.logoUrl} alt="" className="h-5 w-5 rounded shrink-0" />
                    ) : (
                      <div className="h-5 w-5 rounded bg-muted shrink-0" />
                    )}
                    <span className="truncate flex-1">{app.name}</span>
                    <span className="text-muted-foreground shrink-0 flex items-center gap-0.5">
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      {app.rating.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground/60 shrink-0 tabular-nums">
                      {app.reviews.toLocaleString()}
                    </span>
                    {app.isBuiltForShopify && (
                      <Shield className="h-3 w-3 text-violet-500 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
