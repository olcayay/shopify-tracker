"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Info } from "lucide-react";

export function ClassicViewBanner() {
  const { platform, slug } = useParams();

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-muted bg-muted/30 px-4 py-2 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Info className="h-4 w-4" />
        <span>You are viewing the classic layout.</span>
        <Link
          href={`/${platform}/apps/v2/${slug}`}
          className="font-medium text-primary hover:underline"
        >
          Switch to new experience →
        </Link>
      </div>
    </div>
  );
}
