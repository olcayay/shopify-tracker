import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TrendBadgeProps {
  value: number | null;
  previousValue: number | null;
  /** If true, lower values are better (e.g., rank) */
  inverted?: boolean;
  /** Format string: "value" shows just the value, "rank" shows #value */
  format?: "value" | "rank";
  /** Suffix like "/30d" */
  suffix?: string;
}

export function TrendBadge({
  value,
  previousValue,
  inverted = false,
  format = "value",
  suffix,
}: TrendBadgeProps) {
  if (value == null) return <span className="text-muted-foreground">—</span>;

  const displayValue = format === "rank" ? `#${value}` : String(value);

  if (previousValue == null) {
    return (
      <span className="tabular-nums">
        {displayValue}
        {suffix && <span className="text-muted-foreground text-xs ml-0.5">{suffix}</span>}
      </span>
    );
  }

  const rawDelta = value - previousValue;
  const delta = inverted ? -rawDelta : rawDelta;
  // delta > 0 means improvement (value went up, or rank went down if inverted)

  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 tabular-nums">
        {displayValue}
        {suffix && <span className="text-muted-foreground text-xs">{suffix}</span>}
        <Minus className="h-3 w-3 text-muted-foreground" />
      </span>
    );
  }

  const isPositive = delta > 0;
  const absDelta = Math.abs(rawDelta);

  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      {displayValue}
      {suffix && <span className="text-muted-foreground text-xs">{suffix}</span>}
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-xs font-medium",
          isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
        )}
      >
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {inverted ? (isPositive ? `▲${absDelta}` : `▼${absDelta}`) : (rawDelta > 0 ? `+${absDelta}` : `-${absDelta}`)}
      </span>
    </span>
  );
}
