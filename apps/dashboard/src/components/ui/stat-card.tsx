import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { formatNumber } from "@/lib/format-utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  change?: { value: number; label?: string };
  variant?: "default" | "compact";
}

export function StatCard({
  label,
  value,
  icon: Icon,
  change,
  variant = "default",
}: StatCardProps) {
  const isCompact = variant === "compact";

  return (
    <Card>
      <CardContent className={isCompact ? "p-3" : "pt-4 pb-3 px-4"}>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className={`font-bold ${isCompact ? "text-xl" : "text-2xl"}`}>
            {typeof value === "number" ? formatNumber(value) : value}
          </span>
          {change && (
            <span
              className={`text-xs font-medium ${
                change.value > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : change.value < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground"
              }`}
            >
              {change.value > 0 ? "+" : ""}
              {change.value}%{change.label ? ` ${change.label}` : ""}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
