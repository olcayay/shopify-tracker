"use client";

import { getPlatformColor } from "@/lib/platform-display";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";

interface PlatformBadgeCellProps {
  platform: string;
}

export function PlatformBadgeCell({ platform }: PlatformBadgeCellProps) {
  const color = getPlatformColor(platform);
  const label = PLATFORM_DISPLAY[platform as keyof typeof PLATFORM_DISPLAY]?.label ?? platform;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
