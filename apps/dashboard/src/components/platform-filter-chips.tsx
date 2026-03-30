"use client";

import { getPlatformColor } from "@/lib/platform-display";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import type { PlatformId } from "@appranks/shared";

interface PlatformFilterChipsProps {
  enabledPlatforms: PlatformId[];
  activePlatforms: PlatformId[];
  onToggle: (platform: PlatformId) => void;
}

export function PlatformFilterChips({
  enabledPlatforms,
  activePlatforms,
  onToggle,
}: PlatformFilterChipsProps) {
  if (enabledPlatforms.length <= 1) return null;

  const activeSet = new Set(activePlatforms);

  return (
    <div className="flex flex-wrap gap-1.5">
      {enabledPlatforms.map((pid) => {
        const isActive = activeSet.has(pid);
        const color = getPlatformColor(pid);
        const label = PLATFORM_DISPLAY[pid]?.label ?? pid;

        return (
          <button
            key={pid}
            onClick={() => onToggle(pid)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
              isActive
                ? "border-transparent text-white"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
            style={isActive ? { backgroundColor: color } : undefined}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: isActive ? "var(--background)" : color }}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}
