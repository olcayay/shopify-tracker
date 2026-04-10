"use client";

import Link from "next/link";

export function ClassicViewLink({ platform, slug }: { platform: string; slug: string }) {
  return (
    <Link
      href={`/${platform}/apps/v1/${slug}`}
      className="text-xs text-muted-foreground hover:text-foreground ml-auto transition-colors"
      onClick={() => { document.cookie = "app-layout-version=v1; path=/; max-age=31536000"; }}
    >
      Back to classic view
    </Link>
  );
}
