import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Amber highlight class for modified fields in preview */
export const mod = "bg-amber-100 dark:bg-amber-900/40 rounded px-0.5 -mx-0.5 transition-colors";

/** 5-tier color-coded character count badge */
export function CharBadge({ count, max }: { count: number; max: number }) {
  const pct = count / max;
  let colorClass: string;
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
  return (
    <Badge variant="outline" className={cn("text-xs shrink-0", colorClass)}>
      {count}/{max}
    </Badge>
  );
}

/** Editor field wrapper: label + char badge + modified indicator + children */
export function EditorField({
  label,
  count,
  max,
  changed,
  children,
}: {
  label: string;
  count: number;
  max: number;
  changed?: boolean;
  children: React.ReactNode;
}) {
  const over = count > max;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {changed && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              Modified
            </span>
          )}
        </div>
        <CharBadge count={count} max={max} />
      </div>
      {children}
      {over && (
        <p className="text-xs text-red-600">
          Exceeds {max} character limit by {count - max}
        </p>
      )}
    </div>
  );
}
