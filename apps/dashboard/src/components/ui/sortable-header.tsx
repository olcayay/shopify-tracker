import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSort: string;
  currentDir: "asc" | "desc";
  onSort: (key: string) => void;
}

export function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
}: SortableHeaderProps) {
  const isActive = currentSort === sortKey;

  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      {isActive ? (
        currentDir === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3" />
      )}
    </button>
  );
}
