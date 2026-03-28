"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check } from "lucide-react";
import { CompareSection } from "./compare-section";
import { LinkedAppIcon } from "./app-icon";
import type { AppData } from "./compare-types";

export function CategoriesComparison({
  id,
  sectionKey,
  collapsed,
  onToggle,
  apps,
}: {
  id?: string;
  sectionKey: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  apps: AppData[];
}) {
  const { platform } = useParams();
  // Collect all unique feature handles across all apps
  const allFeatures = useMemo(() => {
    const featureMap = new Map<
      string,
      { title: string; category: string; categorySlug: string | null; subcategory: string }
    >();
    for (const app of apps) {
      for (const cat of app.latestSnapshot?.categories || []) {
        const catSlug = cat.url?.match(/\/categories\/([^/?]+)/)?.[1] || null;
        for (const sub of cat.subcategories || []) {
          for (const f of sub.features || []) {
            if (!featureMap.has(f.feature_handle)) {
              featureMap.set(f.feature_handle, {
                title: f.title,
                category: cat.title,
                categorySlug: catSlug,
                subcategory: sub.title,
              });
            }
          }
        }
      }
    }
    return featureMap;
  }, [apps]);

  // Build presence map: feature_handle → set of app slugs
  const featurePresence = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const app of apps) {
      for (const cat of app.latestSnapshot?.categories || []) {
        for (const sub of cat.subcategories || []) {
          for (const f of sub.features || []) {
            if (!map.has(f.feature_handle)) {
              map.set(f.feature_handle, new Set());
            }
            map.get(f.feature_handle)!.add(app.slug);
          }
        }
      }
    }
    return map;
  }, [apps]);

  // Group by category > subcategory
  const grouped = useMemo(() => {
    const result: {
      category: string;
      categorySlug: string | null;
      subcategories: {
        subcategory: string;
        features: { handle: string; title: string }[];
      }[];
    }[] = [];

    const catMap = new Map<
      string,
      { slug: string | null; subMap: Map<string, { handle: string; title: string }[]> }
    >();
    for (const [handle, info] of allFeatures) {
      if (!catMap.has(info.category)) {
        catMap.set(info.category, { slug: info.categorySlug, subMap: new Map() });
      }
      const { subMap } = catMap.get(info.category)!;
      if (!subMap.has(info.subcategory)) subMap.set(info.subcategory, []);
      subMap.get(info.subcategory)!.push({ handle, title: info.title });
    }

    for (const [category, { slug, subMap }] of catMap) {
      const subcategories = [];
      for (const [subcategory, features] of subMap) {
        const primarySlug = apps[0]?.slug;
        features.sort((a, b) => {
          const aInPrimary = primarySlug ? (featurePresence.get(a.handle)?.has(primarySlug) || false) : false;
          const bInPrimary = primarySlug ? (featurePresence.get(b.handle)?.has(primarySlug) || false) : false;
          if (aInPrimary !== bInPrimary) return aInPrimary ? -1 : 1;
          return a.title.localeCompare(b.title);
        });
        subcategories.push({ subcategory, features });
      }
      result.push({ category, categorySlug: slug, subcategories });
    }
    return result;
  }, [allFeatures, featurePresence]);

  if (allFeatures.size === 0) return null;

  return (
    <CompareSection
      id={id}
      title="Category Features"
      sectionKey={sectionKey}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-[160px] min-w-[160px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]">
                Feature
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
            {grouped.map((cat) => (
              <>
                <tr key={`cat-${cat.category}`}>
                  <td
                    colSpan={apps.length + 1}
                    className="pt-4 pb-1 font-semibold text-xs uppercase tracking-wide text-muted-foreground"
                  >
                    {cat.categorySlug ? (
                      <Link href={`/${platform}/categories/${cat.categorySlug}`} className="hover:text-foreground transition-colors">
                        {cat.category}
                      </Link>
                    ) : (
                      cat.category
                    )}
                  </td>
                </tr>
                {cat.subcategories.map((sub) => (
                  <>
                    <tr key={`sub-${cat.category}-${sub.subcategory}`}>
                      <td
                        colSpan={apps.length + 1}
                        className="pt-2 pb-1 pl-2 text-xs font-medium text-muted-foreground"
                      >
                        {sub.subcategory}
                      </td>
                    </tr>
                    {sub.features.map((f) => (
                      <tr
                        key={f.handle}
                        className="border-b last:border-0"
                      >
                        <td className="py-1 pl-4 pr-4">
                          <Link
                            href={`/${platform}/features/${encodeURIComponent(f.handle)}`}
                            className="text-primary hover:underline"
                          >
                            {f.title} ({featurePresence.get(f.handle)?.size || 0})
                          </Link>
                        </td>
                        {apps.map((app) => (
                          <td
                            key={app.slug}
                            className="py-1 px-2 text-center"
                          >
                            {featurePresence.get(f.handle)?.has(app.slug) ? (
                              <Check className="h-4 w-4 text-green-600 mx-auto" strokeWidth={2.5} />
                            ) : null}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </CompareSection>
  );
}
