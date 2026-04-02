"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";

export function AppIcon({
  src,
  alt = "",
  className,
  size,
}: {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  /** Explicit pixel size for next/image width/height. Falls back to 32 if not provided. */
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "shrink-0 bg-muted flex items-center justify-center text-muted-foreground",
          className
        )}
        aria-hidden="true"
      >
        <Package className="w-1/2 h-1/2" />
      </div>
    );
  }

  const px = size || 32;

  return (
    <Image
      src={src}
      alt={alt}
      width={px}
      height={px}
      className={cn("shrink-0 dark:ring-1 dark:ring-border", className)}
      loading="lazy"
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}
