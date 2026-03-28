"use client";

import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { SortKey, SortDir } from "./types";

export function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col)
    return (
      <ArrowUpDown className="inline h-3.5 w-3.5 ml-1 opacity-40" />
    );
  return sortDir === "asc" ? (
    <ArrowUp className="inline h-3.5 w-3.5 ml-1" />
  ) : (
    <ArrowDown className="inline h-3.5 w-3.5 ml-1" />
  );
}
