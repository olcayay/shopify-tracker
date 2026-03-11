"use client";

import { useState, useMemo } from "react";
import { Check, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CatFeature {
  title: string;
  feature_handle: string;
  url: string;
}

interface Subcategory {
  title: string;
  features: CatFeature[];
}

interface Category {
  title: string;
  url: string;
  subcategories: Subcategory[];
}

interface Props {
  /** All category features from competitors */
  competitorCategories: Category[];
  /** Currently selected category features on the virtual app */
  selectedCategories: Category[];
  onAdd: (categoryTitle: string, subcategoryTitle: string, feature: CatFeature) => void;
  onRemove: (categoryTitle: string, subcategoryTitle: string, featureHandle: string) => void;
  disabled?: boolean;
}

export function CategoryFeaturePicker({
  competitorCategories, selectedCategories, onAdd, onRemove, disabled,
}: Props) {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [customCat, setCustomCat] = useState("");
  const [customSub, setCustomSub] = useState("");
  const [customFeat, setCustomFeat] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  // Build a set of selected feature handles for quick lookup
  const selectedHandles = useMemo(() => {
    const set = new Set<string>();
    for (const cat of selectedCategories) {
      for (const sub of cat.subcategories || []) {
        for (const feat of sub.features || []) {
          set.add(`${cat.title}::${sub.title}::${feat.feature_handle}`);
        }
      }
    }
    return set;
  }, [selectedCategories]);

  // Merge competitor categories into a unified view
  const mergedCategories = useMemo(() => {
    const catMap = new Map<string, Map<string, Map<string, CatFeature>>>();

    for (const cat of competitorCategories) {
      if (!catMap.has(cat.title)) catMap.set(cat.title, new Map());
      const subMap = catMap.get(cat.title)!;
      for (const sub of cat.subcategories || []) {
        if (!subMap.has(sub.title)) subMap.set(sub.title, new Map());
        const featMap = subMap.get(sub.title)!;
        for (const feat of sub.features || []) {
          if (!featMap.has(feat.feature_handle)) {
            featMap.set(feat.feature_handle, feat);
          }
        }
      }
    }

    return Array.from(catMap.entries()).map(([catTitle, subMap]) => ({
      title: catTitle,
      subcategories: Array.from(subMap.entries()).map(([subTitle, featMap]) => ({
        title: subTitle,
        features: Array.from(featMap.values()),
      })),
    }));
  }, [competitorCategories]);

  function toggleCat(title: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
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

  function handleCustomAdd() {
    if (!customCat.trim() || !customSub.trim() || !customFeat.trim()) return;
    const handle = customFeat.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    onAdd(customCat.trim(), customSub.trim(), {
      title: customFeat.trim(),
      feature_handle: handle,
      url: "",
    });
    setCustomFeat("");
  }

  return (
    <div className="space-y-1">
      {mergedCategories.map((cat) => {
        const isCatExpanded = expandedCats.has(cat.title);
        return (
          <div key={cat.title}>
            <button
              onClick={() => toggleCat(cat.title)}
              className="flex items-center gap-1.5 w-full text-left py-1.5 px-2 rounded hover:bg-muted/50 text-sm font-medium"
            >
              {isCatExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
              {cat.title}
            </button>
            {isCatExpanded && (
              <div className="ml-4">
                {cat.subcategories.map((sub) => {
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
                      </button>
                      {isSubExpanded && (
                        <div className="ml-5 space-y-0.5">
                          {sub.features.map((feat) => {
                            const key = `${cat.title}::${sub.title}::${feat.feature_handle}`;
                            const isSelected = selectedHandles.has(key);
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
                                {feat.title}
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

      {/* Custom feature input */}
      <div className="pt-2 border-t mt-2">
        {showCustom ? (
          <div className="space-y-2 p-2 bg-muted/30 rounded">
            <Input
              value={customCat}
              onChange={(e) => setCustomCat(e.target.value)}
              placeholder="Category name"
              className="h-8 text-sm"
            />
            <Input
              value={customSub}
              onChange={(e) => setCustomSub(e.target.value)}
              placeholder="Subcategory name"
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Input
                value={customFeat}
                onChange={(e) => setCustomFeat(e.target.value)}
                placeholder="Feature name"
                className="h-8 text-sm flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleCustomAdd()}
              />
              <Button size="sm" variant="secondary" onClick={handleCustomAdd} disabled={disabled || !customFeat.trim()}>
                Add
              </Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setShowCustom(false)} className="text-xs">
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setShowCustom(true)} className="text-xs text-muted-foreground">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add custom
          </Button>
        )}
      </div>
    </div>
  );
}
