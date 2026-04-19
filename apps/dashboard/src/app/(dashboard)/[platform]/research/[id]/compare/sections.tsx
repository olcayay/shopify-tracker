"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "@/components/ui/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppData } from "./types";
import { CharBadge, useKeywordDensity, N_GRAM_COLORS, StarRating, getAppLink, AppIcon } from "./helpers";
import { formatNumber } from "@/lib/format-utils";

// ─── Vertical List (Name / Subtitle / Intro) ────────────────

export function VerticalListSection({
  apps, field, max,
}: {
  apps: AppData[]; field: "name" | "subtitle" | "introduction"; max: number;
}) {
  const { id } = useParams();
  return (
    <div className="space-y-2">
      {apps.map((app) => {
        const isVirtual = app.slug.startsWith("__virtual__");
        const text = field === "name"
          ? app.name
          : field === "subtitle"
            ? app.appCardSubtitle || ""
            : app.latestSnapshot?.appIntroduction || "";
        return (
          <div key={app.slug} className={cn("flex items-start gap-3 py-2 px-3 rounded-md", isVirtual ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-muted/30")}>
            <Link href={getAppLink(app.slug, id as string)} className="shrink-0">
              <AppIcon app={app} />
            </Link>
            <span className="text-sm flex-1 min-w-0">{text || <span className="text-muted-foreground italic">Empty</span>}</span>
            <CharBadge count={text.length} max={max} />
          </div>
        );
      })}
    </div>
  );
}

// ─── App Details ─────────────────────────────────────────────

export function AppDetailsSection({ apps, detailsMax }: { apps: AppData[]; detailsMax: number }) {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState(0);
  const activeApp = apps[activeTab] || apps[0];
  const text = activeApp?.latestSnapshot?.appDetails || "";

  return (
    <div className="space-y-3">
      {/* App tab selector */}
      <div className="flex gap-2 flex-wrap">
        {apps.map((app, i) => (
          <button
            key={app.slug}
            onClick={() => setActiveTab(i)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
              i === activeTab ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            )}
          >
            <AppIcon app={app} size="sm" />
            {app.name.split(/\s/)[0]}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Description */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground">Description</span>
            <CharBadge count={text.length} max={detailsMax} />
          </div>
          <div className="text-sm whitespace-pre-wrap bg-muted/30 rounded-md p-3 max-h-60 overflow-y-auto">
            {text || <span className="text-muted-foreground italic">No description</span>}
          </div>
        </div>

        {/* Keyword Density */}
        <div>
          <span className="text-xs font-medium text-muted-foreground mb-1 block">Keyword Density</span>
          <KeywordDensityTable text={text} />
        </div>
      </div>
    </div>
  );
}

function KeywordDensityTable({ text }: { text: string }) {
  const analysis = useKeywordDensity(text);
  if (analysis.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No repeated keywords found.</p>;
  }
  return (
    <div className="border rounded-md overflow-hidden overflow-x-auto max-h-60 overflow-y-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 sticky top-0">
            <th className="text-left py-1.5 px-3 font-medium">Keyword</th>
            <th className="text-right py-1.5 px-3 font-medium">Count</th>
            <th className="text-right py-1.5 px-3 font-medium">Density</th>
          </tr>
        </thead>
        <tbody>
          {analysis.map((row) => (
            <tr key={row.keyword} className="border-t">
              <td className="py-1 px-3">
                <span className="flex items-center gap-1.5">
                  {row.keyword}
                  {row.n > 1 && (
                    <span className={`text-[10px] px-1 rounded ${N_GRAM_COLORS[row.n]}`}>{row.n}w</span>
                  )}
                </span>
              </td>
              <td className="py-1 px-3 text-right">{row.count}</td>
              <td className="py-1 px-3 text-right">{row.density}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Features Comparison ─────────────────────────────────────

export function FeaturesSection({ apps, featureMax }: { apps: AppData[]; featureMax: number }) {
  const { id } = useParams();
  const maxFeatures = Math.max(...apps.map((a) => a.latestSnapshot?.features?.length || 0), 0);

  if (maxFeatures === 0) {
    return <p className="text-sm text-muted-foreground">No features data available.</p>;
  }

  return (
    <div className="overflow-auto max-h-[60vh]">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-[40px] min-w-[40px] sticky top-0 bg-card z-10 border-b">
              #
            </th>
            {apps.map((app) => (
              <th key={app.slug} className="py-2 px-2 pb-2 min-w-[130px] sticky top-0 bg-card z-10 border-b">
                <div className="flex justify-center">
                  <Link href={getAppLink(app.slug, id as string)} className="inline-flex flex-col items-center gap-1" title={app.name}>
                    <AppIcon app={app} />
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap max-w-[100px] truncate">
                      {app.name.split(/\s/)[0]}
                    </span>
                  </Link>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxFeatures }).map((_, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-2 pr-4 text-muted-foreground align-top">{i + 1}</td>
              {apps.map((app) => {
                const feat = app.latestSnapshot?.features?.[i];
                return (
                  <td key={app.slug} className="py-2 px-2 align-top">
                    {feat ? (
                      <div>
                        <span>{feat}</span>
                        <div className="mt-1">
                          <CharBadge count={feat.length} max={featureMax} />
                        </div>
                      </div>
                    ) : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Set Comparison (Languages / Integrations) ───────────────

export function SetComparisonSection({
  apps, field, linkPrefix,
}: {
  apps: AppData[]; field: "languages" | "integrations"; linkPrefix?: string;
}) {
  const { id } = useParams();
  const allItems = useMemo(() => {
    const itemSet = new Map<string, Set<string>>();
    for (const app of apps) {
      for (const item of (app.latestSnapshot as any)?.[field] || []) {
        if (!itemSet.has(item)) itemSet.set(item, new Set());
        itemSet.get(item)!.add(app.slug);
      }
    }
    return [...itemSet.entries()]
      .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));
  }, [apps, field]);

  if (allItems.length === 0) {
    return <p className="text-sm text-muted-foreground">No {field} data available.</p>;
  }

  return (
    <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
      <table className="w-full text-sm table-fixed">
        <thead className="sticky top-0 bg-background z-10">
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-medium capitalize w-[180px] min-w-[140px]">{field === "languages" ? "Language" : "Integration"}</th>
            <th className="text-center py-2 px-1 font-medium text-xs w-10">#</th>
            {apps.map((app) => (
              <th key={app.slug} className="text-center py-2 px-1">
                <Link href={getAppLink(app.slug, id as string)} className="inline-flex flex-col items-center gap-0.5" title={app.name}>
                  <AppIcon app={app} size="sm" />
                  <span className="text-[9px] text-muted-foreground whitespace-nowrap max-w-[60px] truncate">
                    {app.name.split(/\s/)[0]}
                  </span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allItems.map(([item, slugSet]) => (
            <tr key={item} className="border-t hover:bg-muted/30">
              <td className="py-1.5 px-3 truncate">
                {linkPrefix ? (
                  <Link href={`${linkPrefix}${encodeURIComponent(item)}`} className="hover:underline">{item}</Link>
                ) : (
                  item
                )}
              </td>
              <td className="text-center py-1.5 px-1 text-muted-foreground">{slugSet.size}</td>
              {apps.map((app) => (
                <td key={app.slug} className="text-center py-1.5 px-1">
                  {slugSet.has(app.slug) ? (
                    <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                  ) : (
                    <span className="text-muted-foreground/30">{"\u2014"}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Reviews and Ratings ─────────────────────────────────────

export function ReviewsSection({ apps }: { apps: AppData[] }) {
  const { id } = useParams();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-medium w-32">Metric</th>
            {apps.map((app) => (
              <th key={app.slug} className="text-center py-2 px-3">
                <Link href={getAppLink(app.slug, id as string)} className="inline-flex flex-col items-center gap-1" title={app.name}>
                  <AppIcon app={app} size="sm" />
                  <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{app.name.split(/\s/)[0]}</span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            <td className="py-2 px-3 font-medium">Rating</td>
            {apps.map((app) => {
              const rating = app.latestSnapshot?.averageRating ? parseFloat(app.latestSnapshot.averageRating) : null;
              return (
                <td key={app.slug} className="py-2 px-3 text-center">
                  {rating != null ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <StarRating rating={rating} />
                      <span className="text-sm font-medium">{rating.toFixed(1)}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                  )}
                </td>
              );
            })}
          </tr>
          <tr className="border-t">
            <td className="py-2 px-3 font-medium">Reviews</td>
            {apps.map((app) => (
              <td key={app.slug} className="py-2 px-3 text-center font-medium">
                {app.latestSnapshot?.ratingCount != null ? (
                  <Link href={app.slug.startsWith("__virtual__") ? getAppLink(app.slug, id as string) : `/apps/${app.slug}/reviews`} className="hover:underline">
                    {formatNumber(app.latestSnapshot.ratingCount)}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{"\u2014"}</span>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Category Features ───────────────────────────────────────

export function CategoryFeaturesSection({ apps }: { apps: AppData[] }) {
  const { id } = useParams();
  const { categories } = useMemo(() => {
    const catMap = new Map<string, { title: string; subcategories: Map<string, { title: string; features: Map<string, { handle: string; slugs: Set<string> }> }> }>();

    for (const app of apps) {
      for (const cat of app.latestSnapshot?.categories || []) {
        if (!catMap.has(cat.title)) {
          catMap.set(cat.title, { title: cat.title, subcategories: new Map() });
        }
        const catEntry = catMap.get(cat.title)!;
        for (const sub of cat.subcategories || []) {
          if (!catEntry.subcategories.has(sub.title)) {
            catEntry.subcategories.set(sub.title, { title: sub.title, features: new Map() });
          }
          const subEntry = catEntry.subcategories.get(sub.title)!;
          for (const feat of sub.features || []) {
            const title = feat.title || feat.feature_handle;
            const handle = feat.feature_handle || feat.title;
            if (!subEntry.features.has(title)) {
              subEntry.features.set(title, { handle, slugs: new Set() });
            }
            subEntry.features.get(title)!.slugs.add(app.slug);
          }
        }
      }
    }

    return { categories: [...catMap.values()] };
  }, [apps]);

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">No category features data available.</p>;
  }

  return (
    <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
      <table className="w-full text-sm table-fixed">
        <thead className="sticky top-0 bg-background z-10">
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-medium w-[180px] min-w-[140px]">Feature</th>
            <th className="text-center py-2 px-1 font-medium text-xs w-10">#</th>
            {apps.map((app) => (
              <th key={app.slug} className="text-center py-2 px-1">
                <Link href={getAppLink(app.slug, id as string)} className="inline-flex flex-col items-center gap-0.5" title={app.name}>
                  <AppIcon app={app} size="sm" />
                  <span className="text-[9px] text-muted-foreground whitespace-nowrap max-w-[60px] truncate">
                    {app.name.split(/\s/)[0]}
                  </span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <>
              <tr key={`cat-${cat.title}`} className="bg-muted/50">
                <td colSpan={2 + apps.length} className="py-1.5 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  {cat.title}
                </td>
              </tr>
              {[...cat.subcategories.values()].map((sub) => (
                <>
                  <tr key={`sub-${cat.title}-${sub.title}`} className="bg-muted/20">
                    <td colSpan={2 + apps.length} className="py-1 px-6 text-xs font-medium text-muted-foreground">
                      {sub.title}
                    </td>
                  </tr>
                  {[...sub.features.entries()].map(([featTitle, { handle, slugs }]) => (
                    <tr key={`feat-${cat.title}-${sub.title}-${featTitle}`} className="border-t hover:bg-muted/30">
                      <td className="py-1 px-9 truncate">
                        <Link href={`/features/${encodeURIComponent(handle)}`} className="hover:underline text-xs">
                          {featTitle}
                        </Link>
                      </td>
                      <td className="text-center py-1 px-1 text-muted-foreground text-xs">{slugs.size}</td>
                      {apps.map((app) => (
                        <td key={app.slug} className="text-center py-1 px-1">
                          {slugs.has(app.slug) ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground/30">{"\u2014"}</span>
                          )}
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
  );
}

// ─── Pricing Plans ───────────────────────────────────────────

export function PricingSection({ apps }: { apps: AppData[] }) {
  const { id } = useParams();
  const maxPlans = Math.max(...apps.map((a) => a.latestSnapshot?.pricingPlans?.length || 0), 0);

  if (maxPlans === 0) {
    return <p className="text-sm text-muted-foreground">No pricing data available.</p>;
  }

  const tiers = Array.from({ length: maxPlans }, (_, i) => i);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-medium w-16">Tier</th>
            {apps.map((app) => (
              <th key={app.slug} className="text-center py-2 px-3">
                <Link href={getAppLink(app.slug, id as string)} className="inline-flex flex-col items-center gap-1" title={app.name}>
                  <AppIcon app={app} size="sm" />
                  <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{app.name.split(/\s/)[0]}</span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tiers.map((tierIdx) => (
            <tr key={tierIdx} className="border-t align-top">
              <td className="py-2 px-3 font-medium text-muted-foreground">
                {tierIdx === 0 ? "Free" : `Paid ${tierIdx}`}
              </td>
              {apps.map((app) => {
                const plan = app.latestSnapshot?.pricingPlans?.[tierIdx];
                if (!plan) {
                  return <td key={app.slug} className="py-2 px-3 text-center text-muted-foreground">{"\u2014"}</td>;
                }
                return (
                  <td key={app.slug} className="py-2 px-3">
                    <div className="border rounded-lg p-3 space-y-1">
                      <div className="font-semibold text-sm">{plan.name}</div>
                      <div className="text-sm">
                        {plan.price === "Free" || plan.price === "$0" ? (
                          <span className="text-emerald-600 font-medium">Free</span>
                        ) : (
                          <span className="font-medium">{plan.price}{plan.period ? `/${plan.period}` : ""}</span>
                        )}
                      </div>
                      {plan.trial_text && (
                        <div className="text-xs text-muted-foreground">{plan.trial_text}</div>
                      )}
                      {plan.features?.length > 0 && (
                        <ul className="text-xs text-muted-foreground space-y-0.5 pt-1">
                          {plan.features.slice(0, 5).map((f: string, i: number) => (
                            <li key={i} className="flex gap-1">
                              <span className="shrink-0">-</span>
                              <span className="line-clamp-2">{f}</span>
                            </li>
                          ))}
                          {plan.features.length > 5 && (
                            <li className="text-muted-foreground/60">+{plan.features.length - 5} more</li>
                          )}
                        </ul>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── SEO Section ─────────────────────────────────────────────

export function SeoSection({ apps, seoTitleMax, seoDescMax }: { apps: AppData[]; seoTitleMax: number; seoDescMax: number }) {
  const { id } = useParams();
  return (
    <div className="space-y-4">
      {seoTitleMax > 0 && <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">Title Tag</h4>
        <div className="space-y-2">
          {apps.map((app) => {
            const title = app.latestSnapshot?.seoTitle || "";
            const isVirtual = app.slug.startsWith("__virtual__");
            return (
              <div key={app.slug} className={cn("flex items-start gap-3 py-2 px-3 rounded-md", isVirtual ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-muted/30")}>
                <Link href={getAppLink(app.slug, id as string)} className="shrink-0">
                  <AppIcon app={app} />
                </Link>
                <span className="text-sm flex-1 min-w-0">{title || <span className="text-muted-foreground italic">Empty</span>}</span>
                <CharBadge count={title.length} max={seoTitleMax} />
              </div>
            );
          })}
        </div>
      </div>}
      {seoDescMax > 0 && <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">Meta Description</h4>
        <div className="space-y-2">
          {apps.map((app) => {
            const desc = app.latestSnapshot?.seoMetaDescription || "";
            const isVirtual = app.slug.startsWith("__virtual__");
            return (
              <div key={app.slug} className={cn("flex items-start gap-3 py-2 px-3 rounded-md", isVirtual ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-muted/30")}>
                <Link href={getAppLink(app.slug, id as string)} className="shrink-0">
                  <AppIcon app={app} />
                </Link>
                <span className="text-sm flex-1 min-w-0">{desc || <span className="text-muted-foreground italic">Empty</span>}</span>
                <CharBadge count={desc.length} max={seoDescMax} />
              </div>
            );
          })}
        </div>
      </div>}
    </div>
  );
}
