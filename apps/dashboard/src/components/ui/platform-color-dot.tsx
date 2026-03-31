import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import { cn } from "@/lib/utils";
import type { PlatformId } from "@appranks/shared";

interface PlatformColorDotProps {
  platformId: PlatformId;
  size?: "sm" | "default" | "lg";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "h-1.5 w-1.5",
  default: "h-2 w-2",
  lg: "h-2.5 w-2.5",
};

export function PlatformColorDot({
  platformId,
  size = "default",
  className,
}: PlatformColorDotProps) {
  const color = PLATFORM_DISPLAY[platformId]?.color ?? "#888";
  return (
    <span
      className={cn("inline-block shrink-0 rounded-full", SIZE_CLASSES[size], className)}
      style={{ backgroundColor: color }}
    />
  );
}
