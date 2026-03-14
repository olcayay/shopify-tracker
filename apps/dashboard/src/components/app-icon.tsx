"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

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

  if (!src || failed) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={cn("shrink-0", className)}
      onError={() => setFailed(true)}
    />
  );
}
