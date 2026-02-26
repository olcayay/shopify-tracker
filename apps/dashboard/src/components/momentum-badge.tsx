"use client";

import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const MOMENTUM_CONFIG: Record<string, { symbol: string; color: string; label: string; description: string }> = {
  accelerating: { symbol: "\uD83D\uDE80", color: "text-emerald-600", label: "Accelerating", description: "Review pace is increasing — 7-day rate exceeds 30-day average" },
  stable: { symbol: "\uD83D\uDFE2", color: "text-blue-500", label: "Stable", description: "Review pace is consistent across 7-day and 30-day windows" },
  slowing: { symbol: "\u26A0\uFE0F", color: "text-amber-500", label: "Slowing", description: "Review pace is declining — 7-day rate is below 30-day average" },
  spike: { symbol: "\uD83D\uDD25", color: "text-purple-500", label: "Spike", description: "Unusual surge in reviews — 7-day rate far exceeds 90-day average" },
  flat: { symbol: "\uD83D\uDCA4", color: "text-muted-foreground", label: "Flat", description: "Very few or no reviews in recent periods" },
};

export function MomentumBadge({ momentum }: { momentum?: string | null }) {
  if (!momentum) {
    return <span className="text-muted-foreground">{"\u2014"}</span>;
  }

  const config = MOMENTUM_CONFIG[momentum];
  if (!config) {
    return <span className="text-muted-foreground">{momentum}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 ${config.color}`}>
          <span>{config.symbol}</span>
          <span className="text-xs">{config.label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{config.description}</TooltipContent>
    </Tooltip>
  );
}
