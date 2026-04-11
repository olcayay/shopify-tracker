"use client";

import { getPlatformColor } from "@/lib/platform-display";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";

interface PlatformBadgeCellProps {
  platform: string;
  /** "sm" renders a smaller badge (10px text, 1.5 dot) for compact contexts */
  size?: "sm" | "default";
}

export function PlatformBadgeCell({ platform, size = "default" }: PlatformBadgeCellProps) {
  const color = getPlatformColor(platform);
  const label = PLATFORM_DISPLAY[platform as keyof typeof PLATFORM_DISPLAY]?.label ?? platform;

  const textClass = size === "sm" ? "text-[10px]" : "text-xs";
  const dotClass = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";

  return (
    <span className={`inline-flex items-center gap-1 ${textClass} font-medium text-muted-foreground`}>
      <span
        className={`${dotClass} rounded-full shrink-0`}
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
