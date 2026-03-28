"use client";

import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check } from "lucide-react";
import Link from "next/link";

export function FeatureCoverage({
  features, competitors, virtualApps,
}: {
  features: {
    feature: string; title: string; count: number; total: number;
    competitors: string[]; isGap: boolean;
    categoryType?: string; categoryTitle?: string; subcategoryTitle?: string;
  }[];
  competitors: {
    slug: string; name: string; iconUrl: string | null;
    averageRating: number | null; ratingCount: number | null;
  }[];
  virtualApps?: {
    id: string; researchProjectId: string; name: string;
    icon: string; color: string; iconUrl: string | null;
    categories: any[];
  }[];
}) {
  const { platform } = useParams();
  const competitorSet = useMemo(
    () => new Set(features.flatMap((f) => f.competitors)),
    [features]
  );
  const relevantCompetitors = useMemo(
    () => competitors.filter((c) => competitorSet.has(c.slug)),
    [competitors, competitorSet]
  );

  // Build virtual app feature handle sets
  const vaFeatureHandles = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const va of virtualApps || []) {
      const handles = new Set<string>();
      for (const cat of va.categories || []) {
        for (const sub of cat.subcategories || []) {
          for (const feat of sub.features || []) {
            handles.add(feat.feature_handle);
          }
        }
      }
      map.set(va.id, handles);
    }
    return map;
  }, [virtualApps]);

  // Group features by subcategory, sorted by total checks
  const grouped = useMemo(() => {
    const subMap = new Map<string, typeof features>();

    for (const f of features) {
      const subTitle = f.subcategoryTitle || "Other";
      if (!subMap.has(subTitle)) subMap.set(subTitle, []);
      subMap.get(subTitle)!.push(f);
    }

    return [...subMap.entries()]
      .map(([title, feats]) => ({
        title,
        features: feats.sort((a, b) => b.count - a.count),
        totalChecks: feats.reduce((s, f) => s + f.count, 0),
      }))
      .sort((a, b) => b.totalChecks - a.totalChecks);
  }, [features]);

  const totalColumns = relevantCompetitors.length + (virtualApps?.length || 0) + 1;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[220px] min-w-[160px]">Feature</TableHead>
            {(virtualApps || []).map((va) => (
              <TableHead key={va.id} className="text-center px-2 min-w-[72px]" style={{ backgroundColor: `${va.color || "#3B82F6"}08` }}>
                <Link href={`/${platform}/research/${va.researchProjectId}/virtual-apps/${va.id}`} className="inline-flex flex-col items-center gap-0.5 group" title={va.name}>
                  <div
                    className="h-7 w-7 rounded flex items-center justify-center group-hover:ring-2 transition-all"
                    style={{ backgroundColor: `${va.color || "#3B82F6"}20`, ["--tw-ring-color" as any]: `${va.color || "#3B82F6"}50` }}
                  >
                    <span className="text-sm">{va.icon || "🚀"}</span>
                  </div>
                  <span className="text-[10px] font-medium leading-tight max-w-[68px] truncate" style={{ color: va.color || "#3B82F6" }}>{va.name}</span>
                </Link>
              </TableHead>
            ))}
            {relevantCompetitors.map((comp) => (
              <TableHead key={comp.slug} className="text-center px-2 min-w-[72px]">
                <Link href={`/${platform}/apps/${comp.slug}`} className="inline-flex flex-col items-center gap-0.5 group" title={comp.name}>
                  {comp.iconUrl ? (
                    <img src={comp.iconUrl} alt={comp.name} className="h-7 w-7 rounded group-hover:ring-2 ring-primary/50 transition-all" />
                  ) : (
                    <div className="h-7 w-7 rounded bg-muted group-hover:ring-2 ring-primary/50 transition-all" />
                  )}
                  <span className="text-[10px] font-medium leading-tight max-w-[68px] truncate">{comp.name}</span>
                  <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground leading-none">
                    {comp.averageRating != null && (
                      <>
                        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 text-yellow-500 shrink-0" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        <span>{Number(comp.averageRating).toFixed(1)}</span>
                      </>
                    )}
                    {comp.ratingCount != null && (
                      <span>({comp.ratingCount})</span>
                    )}
                  </div>
                </Link>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped.map((sub) => (
            <React.Fragment key={sub.title}>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={totalColumns} className="py-1.5">
                  <span className="text-xs font-semibold text-foreground">{sub.title}</span>
                  <span className="text-[10px] text-muted-foreground ml-1.5">({sub.totalChecks})</span>
                </TableCell>
              </TableRow>
              {sub.features.map((f) => (
                <TableRow key={f.feature}>
                  <TableCell className="text-sm truncate pl-6" title={f.title}>
                    <Link href={`/${platform}/features/${encodeURIComponent(f.feature)}`} className="hover:underline">
                      {f.title}
                    </Link>
                    <span className="ml-1 text-xs text-muted-foreground">({f.count}/{f.total})</span>
                  </TableCell>
                  {(virtualApps || []).map((va) => (
                    <TableCell key={va.id} className="text-center px-2" style={{ backgroundColor: `${va.color || "#3B82F6"}08` }}>
                      {vaFeatureHandles.get(va.id)?.has(f.feature) ? (
                        <Check className="h-4 w-4 mx-auto" style={{ color: va.color || "#3B82F6" }} />
                      ) : (
                        <span className="text-muted-foreground/30">{"\u2014"}</span>
                      )}
                    </TableCell>
                  ))}
                  {relevantCompetitors.map((comp) => (
                    <TableCell key={comp.slug} className="text-center px-2">
                      {f.competitors.includes(comp.slug) ? (
                        <Check className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground/30">{"\u2014"}</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
