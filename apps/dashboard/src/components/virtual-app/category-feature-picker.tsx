"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompetitorCountBadge } from "./competitor-count-badge";

interface CatFeature {
  title: string;
  feature_handle: string;
  url: string;
}

interface TaxonomyCategory {
  title: string;
  slug: string;
  subcategories: {
    title: string;
    features: CatFeature[];
  }[];
}

interface Props {
  /** Selected category slugs from the category tree picker */
  selectedCategorySlugs: string[];
  /** Competitor data — only used for competitor count badges */
  competitors: { slug: string; name: string; categories: any[] }[];
  selectedFeatures: any[];
  onAdd: (catTitle: string, subTitle: string, feature: CatFeature) => void;
  onRemove: (catTitle: string, subTitle: string, featureHandle: string) => void;
  disabled?: boolean;
  fetchWithAuth: (url: string) => Promise<Response>;
}

export function CategoryFeaturePicker({
  selectedCategorySlugs, competitors, selectedFeatures, onAdd, onRemove, disabled, fetchWithAuth,
}: Props) {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [taxonomy, setTaxonomy] = useState<TaxonomyCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const totalCompetitors = competitors.length;
  const fetchRef = useRef(fetchWithAuth);
  useEffect(() => { fetchRef.current = fetchWithAuth; }, [fetchWithAuth]);

  // Fetch feature taxonomy when selected slugs change
  const slugsKey = selectedCategorySlugs.join(",");
  useEffect(() => {
    if (!slugsKey) {
      setTaxonomy([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchRef.current(`/api/categories/features-by-slugs?slugs=${slugsKey}`)
      .then((res) => res.ok ? res.json() : [])
      .then((data: TaxonomyCategory[]) => {
        if (!cancelled) {
          setTaxonomy(data);
          setExpandedCats(new Set(data.map((c) => c.slug)));
        }
      })
      .catch(() => { if (!cancelled) setTaxonomy([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slugsKey]);

  // Build selected feature handles for quick lookup + flat list for display
  const { selectedHandles, selectedList } = useMemo(() => {
    const set = new Set<string>();
    const list: { catTitle: string; subTitle: string; featTitle: string; featHandle: string }[] = [];
    for (const cat of selectedFeatures) {
      for (const sub of cat.subcategories || []) {
        for (const feat of sub.features || []) {
          const key = `${cat.title}::${sub.title}::${feat.feature_handle}`;
          set.add(key);
          list.push({ catTitle: cat.title, subTitle: sub.title, featTitle: feat.title, featHandle: feat.feature_handle });
        }
      }
    }
    return { selectedHandles: set, selectedList: list };
  }, [selectedFeatures]);

  // Build competitor count per feature_handle (across all competitor categories)
  const competitorFeatureCounts = useMemo(() => {
    const map = new Map<string, { count: number; names: string[] }>();
    for (const comp of competitors) {
      for (const cat of comp.categories || []) {
        for (const sub of cat.subcategories || []) {
          for (const feat of sub.features || []) {
            if (!map.has(feat.feature_handle)) map.set(feat.feature_handle, { count: 0, names: [] });
            const entry = map.get(feat.feature_handle)!;
            if (!entry.names.includes(comp.name)) {
              entry.count++;
              entry.names.push(comp.name);
            }
          }
        }
      }
    }
    return map;
  }, [competitors]);

  function toggleCat(slug: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function toggleSub(key: string) {
    setExpandedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (selectedCategorySlugs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-2">
        Select categories first in the Categories section above.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading category features...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {selectedList.length > 0 && (
        <div className="space-y-1.5">
          {selectedList.map((item) => (
            <div
              key={`${item.catTitle}::${item.subTitle}::${item.featHandle}`}
              className="flex items-center gap-2 py-1 px-2 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-sm"
            >
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.featTitle}</span>
              <span className="text-xs text-blue-500 dark:text-blue-400 shrink-0">{item.subTitle}</span>
              {!disabled && (
                <button
                  onClick={() => onRemove(item.catTitle, item.subTitle, item.featHandle)}
                  className="ml-auto shrink-0 hover:text-red-600 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
      {taxonomy.map((cat) => {
        const isCatExpanded = expandedCats.has(cat.slug);
        const totalFeatures = cat.subcategories.reduce((acc, sub) => acc + sub.features.length, 0);
        return (
          <div key={cat.slug}>
            <button
              onClick={() => toggleCat(cat.slug)}
              className="flex items-center gap-1.5 w-full text-left py-1.5 px-2 rounded hover:bg-muted/50 text-sm font-medium"
            >
              {isCatExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
              {cat.title}
              <span className="text-xs text-muted-foreground ml-1">({totalFeatures} features)</span>
            </button>
            {isCatExpanded && (
              <div className="ml-4">
                {[...cat.subcategories].sort((a, b) => {
                  const sumA = a.features.reduce((s, f) => s + (competitorFeatureCounts.get(f.feature_handle)?.count ?? 0), 0);
                  const sumB = b.features.reduce((s, f) => s + (competitorFeatureCounts.get(f.feature_handle)?.count ?? 0), 0);
                  return sumB - sumA;
                }).map((sub) => {
                  const subKey = `${cat.title}::${sub.title}`;
                  const isSubExpanded = expandedSubs.has(subKey);
                  return (
                    <div key={subKey}>
                      <button
                        onClick={() => toggleSub(subKey)}
                        className="flex items-center gap-1.5 w-full text-left py-1 px-2 rounded hover:bg-muted/50 text-sm text-muted-foreground"
                      >
                        {isSubExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                        {sub.title}
                        <span className="text-xs ml-1">({sub.features.length})</span>
                      </button>
                      {isSubExpanded && (
                        <div className="ml-5 space-y-0.5">
                          {[...sub.features].sort((a, b) => {
                            const ca = competitorFeatureCounts.get(a.feature_handle)?.count ?? 0;
                            const cb = competitorFeatureCounts.get(b.feature_handle)?.count ?? 0;
                            return cb - ca;
                          }).map((feat) => {
                            const key = `${cat.title}::${sub.title}::${feat.feature_handle}`;
                            const isSelected = selectedHandles.has(key);
                            const compData = competitorFeatureCounts.get(feat.feature_handle);
                            return (
                              <button
                                key={feat.feature_handle}
                                onClick={() => {
                                  if (disabled) return;
                                  if (isSelected) {
                                    onRemove(cat.title, sub.title, feat.feature_handle);
                                  } else {
                                    onAdd(cat.title, sub.title, feat);
                                  }
                                }}
                                disabled={disabled}
                                className={cn(
                                  "flex items-center gap-2 w-full text-left py-1 px-2 rounded text-sm transition-colors",
                                  isSelected ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300" : "hover:bg-muted/50"
                                )}
                              >
                                <div className={cn(
                                  "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                                  isSelected ? "bg-blue-600 border-blue-600" : "border-muted-foreground/30"
                                )}>
                                  {isSelected && <Check className="h-3 w-3 text-white" />}
                                </div>
                                <span className="truncate">{feat.title}</span>
                                <CompetitorCountBadge count={compData?.count ?? 0} total={totalCompetitors} names={compData?.names ?? []} className="ml-auto" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {taxonomy.length === 0 && (
        <p className="text-sm text-muted-foreground italic py-2">
          No feature taxonomy found for the selected categories.
        </p>
      )}
      </div>
    </div>
  );
}
