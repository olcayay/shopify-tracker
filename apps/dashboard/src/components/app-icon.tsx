"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";

export function AppIcon({
  src,
  alt = "",
  className,
}: {
  src: string | null | undefined;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "shrink-0 bg-muted flex items-center justify-center text-muted-foreground",
          className
        )}
      >
        <Package className="w-1/2 h-1/2" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn("shrink-0", className)}
      onError={() => setFailed(true)}
    />
  );
}
