"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function CharBadge({ count, max }: { count: number; max?: number }) {
  let colorClass = "border-muted-foreground text-muted-foreground";
  if (max) {
    if (count === 0) {
      colorClass = "border-muted-foreground/50 text-muted-foreground/50";
    } else {
      const pct = count / max;
      if (pct > 1) {
        colorClass = "border-red-600 text-red-600";
      } else if (pct >= 0.9) {
        colorClass = "border-green-600 text-green-600";
      } else if (pct >= 0.8) {
        colorClass = "border-lime-600 text-lime-600";
      } else if (pct >= 0.7) {
        colorClass = "border-yellow-600 text-yellow-600";
      } else if (pct >= 0.6) {
        colorClass = "border-orange-500 text-orange-500";
      } else {
        colorClass = "border-red-600 text-red-600";
      }
    }
  }
  return (
    <Badge
      variant="outline"
      className={cn("text-xs ml-2 shrink-0", colorClass)}
    >
      {count}{max ? `/${max}` : ""}
    </Badge>
  );
}
