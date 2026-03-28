"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

// --- App icon with selection state (same as compare page) ---
export function AppIcon({
  app,
  selected,
  onClick,
  isMain,
}: {
  app: { slug: string; name: string; iconUrl: string | null };
  selected: boolean;
  onClick?: () => void;
  isMain?: boolean;
}) {
  return (
    <div className="group relative flex flex-col items-center">
      <button
        onClick={onClick}
        disabled={isMain}
        className={cn(
          "relative rounded-lg transition-all shrink-0 h-10 w-10",
          selected
            ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background"
            : "opacity-35 hover:opacity-60 grayscale hover:grayscale-0",
          isMain && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background cursor-default"
        )}
      >
        {app.iconUrl ? (
          <img src={app.iconUrl} alt={app.name} className="rounded-lg h-10 w-10" />
        ) : (
          <div className="rounded-lg bg-muted flex items-center justify-center text-xs font-bold h-10 w-10">
            {app.name.charAt(0)}
          </div>
        )}
        {selected && !isMain && (
          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </button>
      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {app.name}
      </span>
    </div>
  );
}
