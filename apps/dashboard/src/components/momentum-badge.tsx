"use client";

const MOMENTUM_CONFIG: Record<string, { symbol: string; color: string; label: string }> = {
  accelerating: { symbol: "\uD83D\uDE80", color: "text-emerald-600", label: "Accelerating" },
  stable: { symbol: "\uD83D\uDFE2", color: "text-blue-500", label: "Stable" },
  slowing: { symbol: "\u26A0\uFE0F", color: "text-amber-500", label: "Slowing" },
  spike: { symbol: "\uD83D\uDD25", color: "text-purple-500", label: "Spike" },
  flat: { symbol: "\uD83D\uDCA4", color: "text-muted-foreground", label: "Flat" },
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
    <span className={`inline-flex items-center gap-1 ${config.color}`}>
      <span>{config.symbol}</span>
      <span className="text-xs">{config.label}</span>
    </span>
  );
}
