"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { CompareSection } from "./compare-section";
import { LinkedAppIcon } from "./app-icon";
import type { AppData } from "./compare-types";

export function BadgeComparisonSection({
  id,
  title,
  sectionKey,
  collapsed,
  onToggle,
  apps,
  getItems,
  linkPrefix,
}: {
  id?: string;
  title: string;
  sectionKey: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  apps: AppData[];
  getItems: (app: AppData) => string[];
  linkPrefix?: string;
}) {
  // Build presence map
  const presenceMap = useMemo(() => {
    const set = new Set<string>();
    for (const app of apps) {
      for (const item of getItems(app)) set.add(item);
    }
    const map = new Map<string, Set<string>>();
    for (const item of set) {
      const appSlugs = new Set<string>();
      for (const app of apps) {
        if (getItems(app).includes(item)) appSlugs.add(app.slug);
      }
      map.set(item, appSlugs);
    }
    return map;
  }, [apps, getItems]);

  // Sort: most common items first, then alphabetically
  const allItems = useMemo(() => {
    return [...presenceMap.keys()].sort((a, b) => {
      const aCount = presenceMap.get(a)?.size || 0;
      const bCount = presenceMap.get(b)?.size || 0;
      if (aCount !== bCount) return bCount - aCount;
      return a.localeCompare(b);
    });
  }, [presenceMap]);

  if (allItems.length === 0) return null;

  return (
    <CompareSection
      id={id}
      title={title}
      sectionKey={sectionKey}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-[160px] min-w-[160px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]">
                {title}
              </th>
              {apps.map((app) => (
                <th key={app.slug} className="py-2 px-2 pb-6 text-center min-w-[130px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]">
                  <div className="flex justify-center">
                    <LinkedAppIcon app={app} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allItems.map((item) => (
              <tr key={item} className="border-b last:border-0">
                <td className="py-1.5 pr-4 w-[160px] min-w-[160px]">
                  {linkPrefix ? (
                    <Link href={`${linkPrefix}/${encodeURIComponent(item)}`}>
                      <Badge variant="outline" className="text-xs hover:bg-accent cursor-pointer">
                        {item} ({presenceMap.get(item)?.size || 0})
                      </Badge>
                    </Link>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {item} ({presenceMap.get(item)?.size || 0})
                    </Badge>
                  )}
                </td>
                {apps.map((app) => (
                  <td key={app.slug} className="py-1.5 px-2 text-center">
                    {presenceMap.get(item)?.has(app.slug) ? (
                      <Check className="h-4 w-4 text-green-600 mx-auto" strokeWidth={2.5} />
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CompareSection>
  );
}
