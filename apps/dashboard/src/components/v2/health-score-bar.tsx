import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Search, Award, Megaphone } from "lucide-react";

function getScoreColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function getScoreTextColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function TrendIndicator({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) {
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  if (delta > 0) {
    return (
      <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
        <TrendingUp className="h-3.5 w-3.5" />+{delta}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400 text-xs font-medium">
      <TrendingDown className="h-3.5 w-3.5" />{delta}
    </span>
  );
}

interface HealthScoreBarProps {
  visibilityScore: number | null;
  visibilityDelta: number | null;
  powerScore: number | null;
  powerDelta: number | null;
  keywordCount: number;
  avgPosition: number | null;
  featuredCount: number;
}

export function HealthScoreBar({
  visibilityScore,
  visibilityDelta,
  powerScore,
  powerDelta,
  keywordCount,
  avgPosition,
  featuredCount,
}: HealthScoreBarProps) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Visibility Score */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Visibility</span>
            <div className="flex items-center gap-1.5">
              {visibilityScore != null ? (
                <>
                  <span className={cn("text-lg font-bold tabular-nums", getScoreTextColor(visibilityScore))}>
                    {Math.round(visibilityScore)}
                  </span>
                  <TrendIndicator delta={visibilityDelta} />
                </>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                visibilityScore != null ? getScoreColor(visibilityScore) : "bg-muted",
              )}
              style={{ width: `${Math.min(100, Math.max(0, visibilityScore ?? 0))}%` }}
            />
          </div>
        </div>

        {/* Power Score */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Power</span>
            <div className="flex items-center gap-1.5">
              {powerScore != null ? (
                <>
                  <span className={cn("text-lg font-bold tabular-nums", getScoreTextColor(powerScore))}>
                    {Math.round(powerScore)}
                  </span>
                  <TrendIndicator delta={powerDelta} />
                </>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                powerScore != null ? getScoreColor(powerScore) : "bg-muted",
              )}
              style={{ width: `${Math.min(100, Math.max(0, powerScore ?? 0))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t flex-wrap">
        <span className="flex items-center gap-1">
          <Search className="h-3 w-3" />
          {keywordCount} keywords ranked
        </span>
        {avgPosition != null && (
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Avg position: #{avgPosition.toFixed(1)}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Award className="h-3 w-3" />
          {featuredCount} featured spots
        </span>
      </div>
    </div>
  );
}
