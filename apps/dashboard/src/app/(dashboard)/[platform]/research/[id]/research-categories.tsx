"use client";

import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import { Star } from "lucide-react";
import Link from "@/components/ui/link";
import { formatCategoryTitle } from "@/lib/platform-urls";
import { type PlatformId } from "@appranks/shared";
import { formatNumber } from "@/lib/format-utils";

export function CategoryLandscape({
  categories, competitors, keywordRankings,
}: {
  categories: {
    slug: string; title: string; competitorCount: number; total: number;
    competitors: { slug: string; position: number }[];
  }[];
  competitors: {
    slug: string; name: string; iconUrl: string | null;
    averageRating: number | null; ratingCount: number | null;
  }[];
  keywordRankings: Record<string, Record<string, number>>;
}) {
  const { platform } = useParams();
  const compMap = useMemo(
    () => new Map(competitors.map((c) => [c.slug, c])),
    [competitors]
  );

  const rankedKeywordCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const appMap of Object.values(keywordRankings)) {
      for (const slug of Object.keys(appMap)) {
        counts.set(slug, (counts.get(slug) || 0) + 1);
      }
    }
    return counts;
  }, [keywordRankings]);

  return (
    <div className="space-y-5">
      {categories.map((cat) => (
        <div key={cat.slug}>
          <div className="flex items-center justify-between mb-2">
            <Link href={`/${platform}/categories/${cat.slug}`} className="font-medium text-sm hover:underline">
              {formatCategoryTitle(platform as PlatformId, cat.slug, cat.title)}
            </Link>
            <span className="text-xs text-muted-foreground">
              {cat.competitorCount}/{cat.total} apps
            </span>
          </div>
          <div className="space-y-1.5 pl-3 border-l-2 border-muted">
            {[...cat.competitors].sort((a, b) => a.position - b.position).map((c) => {
              const comp = compMap.get(c.slug);
              if (!comp) return null;
              return (
                <div key={c.slug} className="flex items-center gap-3 py-1">
                  <span className="text-xs font-mono text-muted-foreground w-8 text-right shrink-0">#{c.position}</span>
                  <Link href={`/${platform}/apps/${c.slug}`} className="flex items-center gap-2 min-w-0 flex-1 group">
                    {comp.iconUrl ? (
                      <img src={comp.iconUrl} alt={comp.name} className="h-6 w-6 rounded shrink-0" />
                    ) : (
                      <div className="h-6 w-6 rounded bg-muted shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate group-hover:underline">{comp.name}</span>
                  </Link>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                    {comp.averageRating != null && (
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {comp.averageRating.toFixed(1)}
                      </span>
                    )}
                    {comp.ratingCount != null && (
                      <span className="w-14 text-right">{formatNumber(comp.ratingCount)} rev</span>
                    )}
                    {(rankedKeywordCounts.get(c.slug) ?? 0) > 0 && (
                      <span className="w-12 text-right">{rankedKeywordCounts.get(c.slug)} kw</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
