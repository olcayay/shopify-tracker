import { cn } from "@/lib/utils";

type StatusVariant = "success" | "warning" | "error" | "info" | "neutral" | "active" | "inactive";

interface StatusIndicatorProps {
  variant: StatusVariant;
  label: string;
  size?: "sm" | "default";
  pulse?: boolean;
}

const DOT_COLORS: Record<StatusVariant, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  info: "bg-blue-500",
  neutral: "bg-slate-400 dark:bg-slate-500",
  active: "bg-emerald-500",
  inactive: "bg-slate-400 dark:bg-slate-500",
};

const TEXT_COLORS: Record<StatusVariant, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
  info: "text-blue-600 dark:text-blue-400",
  neutral: "text-muted-foreground",
  active: "text-emerald-600 dark:text-emerald-400",
  inactive: "text-muted-foreground",
};

export function StatusIndicator({
  variant,
  label,
  size = "default",
  pulse = false,
}: StatusIndicatorProps) {
  const dotSize = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const gap = size === "sm" ? "gap-1" : "gap-1.5";

  return (
    <span className={cn("inline-flex items-center", gap)}>
      <span className="relative flex shrink-0">
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              DOT_COLORS[variant],
            )}
          />
        )}
        <span className={cn("rounded-full", dotSize, DOT_COLORS[variant])} />
      </span>
      <span className={cn(textSize, TEXT_COLORS[variant])}>{label}</span>
    </span>
  );
}
