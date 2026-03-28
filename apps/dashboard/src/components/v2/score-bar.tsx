import { cn } from "@/lib/utils";

function getScoreColor(score: number): string {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  if (score >= 25) return "bg-orange-500";
  return "bg-red-500";
}

export function ScoreBar({
  label,
  score,
  maxScore = 100,
}: {
  label: string;
  score: number | null;
  maxScore?: number;
}) {
  if (score == null) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground font-medium">{label}:</span>
        <span className="text-muted-foreground/50">—</span>
      </div>
    );
  }

  const pct = Math.min(100, Math.max(0, (score / maxScore) * 100));

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground font-medium">{label}:</span>
      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", getScoreColor(score))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-semibold tabular-nums">{Math.round(score)}</span>
    </div>
  );
}
