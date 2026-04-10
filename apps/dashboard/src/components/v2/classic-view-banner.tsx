"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Sparkles, ArrowRight } from "lucide-react";

export function ClassicViewBanner() {
  const { platform, slug } = useParams();

  return (
    <div className="group flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm hover:bg-primary/10 transition-colors">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-muted-foreground">You are viewing the classic layout.</span>
        <Link
          href={`/${platform}/apps/v2/${slug}`}
          className="font-medium text-primary hover:underline inline-flex items-center gap-1"
          onClick={() => { document.cookie = "app-layout-version=v2; path=/; max-age=31536000"; }}
        >
          Switch to new experience
          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
