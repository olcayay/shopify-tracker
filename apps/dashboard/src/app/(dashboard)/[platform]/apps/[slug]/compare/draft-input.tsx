"use client";

import { Pencil } from "lucide-react";
import { CharBadge } from "./char-badge";

export function DraftInput({
  value,
  onChange,
  max,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-md border border-dashed border-muted-foreground/30">
      <Pencil className="h-4 w-4 text-muted-foreground shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, max))}
        maxLength={max}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
      />
      <CharBadge count={value.length} max={max} />
    </div>
  );
}
