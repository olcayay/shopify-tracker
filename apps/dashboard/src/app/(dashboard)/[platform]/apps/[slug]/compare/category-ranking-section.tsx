"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CompareSection } from "./compare-section";
import { LinkedAppIcon } from "./app-icon";
import type { AppData, CategoryRanking } from "./compare-types";

export function CategoryRankingSection({
  id,
  sectionKey,
  collapsed,
  onToggle,
  apps,
  rankingsData,
}: {

  id?: string;
  sectionKey: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  apps: AppData[];
  rankingsData: Map<string, CategoryRanking[]>;
}) {
  const { platform } = useParams();
  // Build per-app ranking lookup: appSlug → categorySlug → position
  const appRankingMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const app of apps) {
      const rankings = rankingsData.get(app.slug) || [];
      const catMap = new Map<string, number>();
      for (const r of rankings) {
        catMap.set(r.categorySlug, r.position);
      }
      map.set(app.slug, catMap);
    }
    return map;
  }, [apps, rankingsData]);

  // Get primary category per app (first category from snapshot)
  const appPrimaryCategory = useMemo(() => {
    const map = new Map<string, string>();
    for (const app of apps) {
      const cats = app.latestSnapshot?.categories || [];
      if (cats.length > 0) {
        map.set(app.slug, cats[0].title || "—");
      }
    }
    return map;
  }, [apps]);

  // Collect all unique categories across all apps' rankings
  // Sort: primary app categories first (alphabetically), then rest (alphabetically)
  const allCategories = useMemo(() => {
    const catMap = new Map<string, string>(); // slug → title
    for (const app of apps) {
      for (const r of rankingsData.get(app.slug) || []) {
        if (!catMap.has(r.categorySlug)) {
          catMap.set(r.categorySlug, r.categoryTitle);
        }
      }
    }
    const primarySlug = apps[0]?.slug;
    const primaryRankings = primarySlug ? appRankingMap.get(primarySlug) : undefined;
    return [...catMap.entries()].sort((a, b) => {
      const aInPrimary = primaryRankings?.has(a[0]) || false;
      const bInPrimary = primaryRankings?.has(b[0]) || false;
      if (aInPrimary !== bInPrimary) return aInPrimary ? -1 : 1;
      return a[1].localeCompare(b[1]);
    });
  }, [apps, rankingsData, appRankingMap]);

  if (allCategories.length === 0) return null;

  return (
    <CompareSection
      id={id}
      title="Category Ranking"
      sectionKey={sectionKey}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-[160px] min-w-[160px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]" />
              {apps.map((app) => (
                <th key={app.slug} className="py-2 px-2 pb-2 text-center min-w-[130px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]">
                  <div className="flex flex-col items-center gap-1">
                    <LinkedAppIcon app={app} />
                    <span className="text-[10px] font-medium text-muted-foreground">{appPrimaryCategory.get(app.slug) || ""}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allCategories.map(([catSlug, catTitle]) => (
              <tr key={catSlug} className="border-b last:border-0">
                <td className="py-2 pr-4">
                  <Link
                    href={`/${platform}/categories/${catSlug}`}
                    className="text-primary hover:underline"
                  >
                    {catTitle}
                  </Link>
                </td>
                {apps.map((app) => {
                  const pos = appRankingMap.get(app.slug)?.get(catSlug);
                  return (
                    <td key={app.slug} className="py-2 px-2 text-center">
                      {pos != null ? (
                        <span className="font-bold">{pos}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CompareSection>
  );
}
