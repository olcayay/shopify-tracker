"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppData {
  slug: string;
  name: string;
  iconUrl: string | null;
  appCardSubtitle: string | null;
  latestSnapshot: {
    appIntroduction: string;
    appDetails: string;
    features: string[];
    languages: string[];
    integrations: string[];
    pricingPlans: any[];
    categories: any[];
    seoTitle: string;
    seoMetaDescription: string;
  } | null;
}

function CharBadge({ count, max }: { count: number; max?: number }) {
  const good = max ? count >= max * 0.7 && count <= max : count > 0;
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs ml-2 shrink-0",
        good
          ? "border-green-600 text-green-600"
          : "border-orange-500 text-orange-500"
      )}
    >
      {count} characters
    </Badge>
  );
}

function AppIcon({
  app,
  selected,
  onClick,
  isMain,
  size = "md",
}: {
  app: { slug: string; name: string; iconUrl: string | null };
  selected: boolean;
  onClick?: () => void;
  isMain?: boolean;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <button
      onClick={onClick}
      disabled={isMain}
      title={app.name}
      className={cn(
        "relative rounded-lg transition-all shrink-0",
        sizeClass,
        selected
          ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background"
          : "opacity-35 hover:opacity-60 grayscale hover:grayscale-0",
        isMain && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background cursor-default"
      )}
    >
      {app.iconUrl ? (
        <img
          src={app.iconUrl}
          alt={app.name}
          className={cn("rounded-lg", sizeClass)}
        />
      ) : (
        <div
          className={cn(
            "rounded-lg bg-muted flex items-center justify-center text-xs font-bold",
            sizeClass
          )}
        >
          {app.name.charAt(0)}
        </div>
      )}
      {selected && !isMain && (
        <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
          <Check className="h-2.5 w-2.5 text-white" />
        </div>
      )}
    </button>
  );
}

export default function ComparePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { fetchWithAuth } = useAuth();

  const [mainApp, setMainApp] = useState<AppData | null>(null);
  const [competitors, setCompetitors] = useState<
    { slug: string; name: string; iconUrl: string | null }[]
  >([]);
  const [competitorData, setCompetitorData] = useState<Map<string, AppData>>(
    new Map()
  );
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeDetailSlug, setActiveDetailSlug] = useState<string>("");

  useEffect(() => {
    loadData();
  }, [slug]);

  async function loadData() {
    setLoading(true);

    // Fetch main app + competitor list in parallel
    const [appRes, compRes] = await Promise.all([
      fetchWithAuth(`/api/apps/${encodeURIComponent(slug)}`),
      fetchWithAuth(
        `/api/account/tracked-apps/${encodeURIComponent(slug)}/competitors`
      ),
    ]);

    let mainAppData: AppData | null = null;
    let compList: { slug: string; name: string; iconUrl: string | null }[] = [];

    if (appRes.ok) {
      mainAppData = await appRes.json();
      setMainApp(mainAppData);
      setActiveDetailSlug(mainAppData!.slug);
    }

    if (compRes.ok) {
      const comps = await compRes.json();
      compList = comps.map((c: any) => ({
        slug: c.appSlug,
        name: c.appName || c.appSlug,
        iconUrl: c.iconUrl,
      }));
      setCompetitors(compList);
      setSelectedSlugs(new Set(compList.map((c) => c.slug)));
    }

    // Fetch full data for all competitors in parallel
    if (compList.length > 0) {
      const results = await Promise.all(
        compList.map(async (c) => {
          const res = await fetchWithAuth(
            `/api/apps/${encodeURIComponent(c.slug)}`
          );
          if (res.ok) {
            const data: AppData = await res.json();
            return [c.slug, data] as [string, AppData];
          }
          return null;
        })
      );

      const map = new Map<string, AppData>();
      for (const r of results) {
        if (r) map.set(r[0], r[1]);
      }
      setCompetitorData(map);
    }

    setLoading(false);
  }

  function toggleCompetitor(compSlug: string) {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(compSlug)) {
        next.delete(compSlug);
      } else {
        next.add(compSlug);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedSlugs.size === competitors.length) {
      setSelectedSlugs(new Set());
    } else {
      setSelectedSlugs(new Set(competitors.map((c) => c.slug)));
    }
  }

  // Build ordered list of selected apps (main first, then selected competitors)
  const selectedApps = useMemo(() => {
    const apps: AppData[] = [];
    if (mainApp) apps.push(mainApp);
    for (const c of competitors) {
      if (selectedSlugs.has(c.slug) && competitorData.has(c.slug)) {
        apps.push(competitorData.get(c.slug)!);
      }
    }
    return apps;
  }, [mainApp, competitors, selectedSlugs, competitorData]);

  if (loading) {
    return (
      <p className="text-muted-foreground text-center py-8">Loading...</p>
    );
  }

  if (!mainApp) {
    return <p className="text-muted-foreground">App not found.</p>;
  }

  if (competitors.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center py-8">
            No competitors to compare. Add competitors first from the
            Competitors tab.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* App Selector Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 flex-wrap">
            <AppIcon
              app={{
                slug: mainApp.slug,
                name: mainApp.name,
                iconUrl: mainApp.iconUrl,
              }}
              selected
              isMain
            />
            <div className="w-px h-8 bg-border" />
            {competitors.map((c) => (
              <AppIcon
                key={c.slug}
                app={c}
                selected={selectedSlugs.has(c.slug)}
                onClick={() => toggleCompetitor(c.slug)}
              />
            ))}
            <button
              onClick={toggleAll}
              className="text-xs text-muted-foreground hover:text-foreground ml-2 transition-colors"
            >
              {selectedSlugs.size === competitors.length
                ? "Deselect all"
                : "Select all"}
            </button>
          </div>
        </CardContent>
      </Card>

      {selectedApps.length <= 1 && (
        <p className="text-muted-foreground text-center py-4 text-sm">
          Select at least one competitor to compare.
        </p>
      )}

      {selectedApps.length > 1 && (
        <>
          {/* App Name */}
          <VerticalListSection title="App Name" apps={selectedApps} mainSlug={mainApp.slug}>
            {(app) => (
              <div className="flex items-center">
                <span className="text-sm font-medium">
                  {app.name}
                </span>
                <CharBadge count={app.name.length} max={30} />
              </div>
            )}
          </VerticalListSection>

          {/* App Introduction */}
          <VerticalListSection
            title="App Introduction"
            apps={selectedApps}
            mainSlug={mainApp.slug}
          >
            {(app) => (
              <div>
                <div className="flex items-start gap-2">
                  <p className="text-sm flex-1">
                    {app.latestSnapshot?.appIntroduction || "—"}
                  </p>
                  {app.latestSnapshot?.appIntroduction && (
                    <CharBadge
                      count={app.latestSnapshot.appIntroduction.length}
                    />
                  )}
                </div>
              </div>
            )}
          </VerticalListSection>

          {/* App Details — icon-tab mode */}
          <Card>
            <CardHeader>
              <CardTitle>App Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                {selectedApps.map((app) => (
                  <AppIcon
                    key={app.slug}
                    app={{
                      slug: app.slug,
                      name: app.name,
                      iconUrl: app.iconUrl,
                    }}
                    selected={activeDetailSlug === app.slug}
                    onClick={() => setActiveDetailSlug(app.slug)}
                    size="sm"
                    isMain={false}
                  />
                ))}
              </div>
              {(() => {
                const active = selectedApps.find(
                  (a) => a.slug === activeDetailSlug
                );
                if (!active?.latestSnapshot?.appDetails) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      No app details available.
                    </p>
                  );
                }
                return (
                  <div>
                    <CharBadge
                      count={active.latestSnapshot.appDetails.length}
                    />
                    <p className="text-sm mt-2 whitespace-pre-line">
                      {active.latestSnapshot.appDetails}
                    </p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 text-muted-foreground font-medium">
                        #
                      </th>
                      {selectedApps.map((app) => (
                        <th key={app.slug} className="py-2 px-2 min-w-[200px]">
                          <div className="flex justify-center">
                            {app.iconUrl ? (
                              <img
                                src={app.iconUrl}
                                alt={app.name}
                                title={app.name}
                                className="h-6 w-6 rounded"
                              />
                            ) : (
                              <span className="text-xs">{app.name}</span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({
                      length: Math.max(
                        ...selectedApps.map(
                          (a) => a.latestSnapshot?.features?.length || 0
                        )
                      ),
                    }).map((_, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-4 text-muted-foreground align-top">
                          {i + 1}
                        </td>
                        {selectedApps.map((app) => (
                          <td
                            key={app.slug}
                            className="py-2 px-2 align-top"
                          >
                            {app.latestSnapshot?.features?.[i] || ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Languages */}
          <BadgeComparisonSection
            title="Languages"
            apps={selectedApps}
            getItems={(app) => app.latestSnapshot?.languages || []}
          />

          {/* Integrations */}
          <BadgeComparisonSection
            title="Integrations"
            apps={selectedApps}
            getItems={(app) => app.latestSnapshot?.integrations || []}
          />

          {/* Pricing Plans */}
          <PricingComparison apps={selectedApps} />

          {/* Categories & Features */}
          <CategoriesComparison apps={selectedApps} />

          {/* Web Search Content */}
          <VerticalListSection
            title="Web Search Content"
            apps={selectedApps}
            mainSlug={mainApp.slug}
          >
            {(app) => {
              const s = app.latestSnapshot;
              if (!s?.seoTitle && !s?.seoMetaDescription) {
                return <span className="text-sm text-muted-foreground">—</span>;
              }
              return (
                <div className="space-y-2">
                  {s?.seoTitle && (
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Title Tag
                      </span>
                      <CharBadge count={s.seoTitle.length} max={70} />
                      <p className="text-sm mt-0.5">{s.seoTitle}</p>
                    </div>
                  )}
                  {s?.seoMetaDescription && (
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Meta Description
                      </span>
                      <CharBadge count={s.seoMetaDescription.length} max={160} />
                      <p className="text-sm mt-0.5">{s.seoMetaDescription}</p>
                    </div>
                  )}
                </div>
              );
            }}
          </VerticalListSection>
        </>
      )}
    </div>
  );
}

// --- Reusable Section Components ---

function VerticalListSection({
  title,
  apps,
  mainSlug,
  children,
}: {
  title: string;
  apps: AppData[];
  mainSlug: string;
  children: (app: AppData) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {apps.map((app) => (
          <div
            key={app.slug}
            className={cn(
              "flex items-start gap-3 p-2 rounded-md",
              app.slug === mainSlug && "bg-muted/50"
            )}
          >
            {app.iconUrl ? (
              <img
                src={app.iconUrl}
                alt=""
                title={app.name}
                className="h-6 w-6 rounded shrink-0 mt-0.5"
              />
            ) : (
              <div className="h-6 w-6 rounded bg-muted flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {app.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">{children(app)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BadgeComparisonSection({
  title,
  apps,
  getItems,
}: {
  title: string;
  apps: AppData[];
  getItems: (app: AppData) => string[];
}) {
  // Collect all unique items
  const allItems = useMemo(() => {
    const set = new Set<string>();
    for (const app of apps) {
      for (const item of getItems(app)) set.add(item);
    }
    return [...set].sort();
  }, [apps, getItems]);

  // Build presence map
  const presenceMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of allItems) {
      const appSlugs = new Set<string>();
      for (const app of apps) {
        if (getItems(app).includes(item)) appSlugs.add(app.slug);
      }
      map.set(item, appSlugs);
    }
    return map;
  }, [allItems, apps, getItems]);

  if (allItems.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 text-muted-foreground font-medium">
                  {title}
                </th>
                {apps.map((app) => (
                  <th key={app.slug} className="py-2 px-2 text-center">
                    {app.iconUrl ? (
                      <img
                        src={app.iconUrl}
                        alt={app.name}
                        title={app.name}
                        className="h-6 w-6 rounded mx-auto"
                      />
                    ) : (
                      <span className="text-xs">{app.name.charAt(0)}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allItems.map((item) => (
                <tr key={item} className="border-b last:border-0">
                  <td className="py-1.5 pr-4">
                    <Badge variant="outline" className="text-xs">
                      {item}
                    </Badge>
                  </td>
                  {apps.map((app) => (
                    <td key={app.slug} className="py-1.5 px-2 text-center">
                      {presenceMap.get(item)?.has(app.slug) ? (
                        <Check className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function PricingComparison({ apps }: { apps: AppData[] }) {
  // Split each app's plans into free + paid (sorted by price ascending)
  const appPlans = useMemo(() => {
    return apps.map((app) => {
      const plans = app.latestSnapshot?.pricingPlans || [];
      const free = plans.filter((p: any) => !p.price || Number(p.price) === 0);
      const paid = plans
        .filter((p: any) => p.price && Number(p.price) > 0)
        .sort((a: any, b: any) => Number(a.price) - Number(b.price));
      return { free, paid };
    });
  }, [apps]);

  const hasAnyFree = appPlans.some((ap) => ap.free.length > 0);
  const maxPaid = Math.max(...appPlans.map((ap) => ap.paid.length), 0);
  const totalRows = (hasAnyFree ? 1 : 0) + maxPaid;

  if (totalRows === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing Plans</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-[80px]">
                  Tier
                </th>
                {apps.map((app) => (
                  <th key={app.slug} className="py-2 px-2" style={{ minWidth: 200 }}>
                    <div className="flex justify-center">
                      {app.iconUrl ? (
                        <img
                          src={app.iconUrl}
                          alt={app.name}
                          title={app.name}
                          className="h-6 w-6 rounded"
                        />
                      ) : (
                        <span className="text-xs">{app.name.charAt(0)}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hasAnyFree && (
                <tr className="border-b align-top">
                  <td className="py-2 pr-4 text-muted-foreground font-medium">
                    Free
                  </td>
                  {appPlans.map((ap, idx) => (
                    <td key={apps[idx].slug} className="py-2 px-2">
                      {ap.free.length > 0 ? (
                        <PlanCard plan={ap.free[0]} />
                      ) : (
                        <div className="text-muted-foreground text-center">—</div>
                      )}
                    </td>
                  ))}
                </tr>
              )}
              {Array.from({ length: maxPaid }).map((_, rowIdx) => (
                <tr key={`paid-${rowIdx}`} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-4 text-muted-foreground font-medium">
                    {hasAnyFree ? `Paid ${rowIdx + 1}` : `Plan ${rowIdx + 1}`}
                  </td>
                  {appPlans.map((ap, idx) => (
                    <td key={apps[idx].slug} className="py-2 px-2">
                      {ap.paid[rowIdx] ? (
                        <PlanCard plan={ap.paid[rowIdx]} />
                      ) : (
                        <div className="text-muted-foreground text-center">—</div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanCard({ plan }: { plan: any }) {
  return (
    <div className="border rounded-lg p-3">
      <div className="font-semibold">{plan.name}</div>
      <div className="text-lg font-bold mt-1">
        {plan.price ? `$${plan.price}/${plan.period || "mo"}` : "Free"}
      </div>
      {plan.trial_text && (
        <p className="text-xs text-muted-foreground mt-1">
          {plan.trial_text}
        </p>
      )}
      {plan.features?.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {plan.features.map((f: string, j: number) => (
            <li key={j} className="text-xs text-muted-foreground">
              • {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoriesComparison({ apps }: { apps: AppData[] }) {
  // Collect all unique feature handles across all apps
  const allFeatures = useMemo(() => {
    const featureMap = new Map<
      string,
      { title: string; category: string; subcategory: string }
    >();
    for (const app of apps) {
      for (const cat of app.latestSnapshot?.categories || []) {
        for (const sub of cat.subcategories || []) {
          for (const f of sub.features || []) {
            if (!featureMap.has(f.feature_handle)) {
              featureMap.set(f.feature_handle, {
                title: f.title,
                category: cat.title,
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
      subcategories: {
        subcategory: string;
        features: { handle: string; title: string }[];
      }[];
    }[] = [];

    const catMap = new Map<
      string,
      Map<string, { handle: string; title: string }[]>
    >();
    for (const [handle, info] of allFeatures) {
      if (!catMap.has(info.category)) catMap.set(info.category, new Map());
      const subMap = catMap.get(info.category)!;
      if (!subMap.has(info.subcategory)) subMap.set(info.subcategory, []);
      subMap.get(info.subcategory)!.push({ handle, title: info.title });
    }

    for (const [category, subMap] of catMap) {
      const subcategories = [];
      for (const [subcategory, features] of subMap) {
        subcategories.push({ subcategory, features });
      }
      result.push({ category, subcategories });
    }
    return result;
  }, [allFeatures]);

  if (allFeatures.size === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categories & Features</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 text-muted-foreground font-medium">
                  Feature
                </th>
                {apps.map((app) => (
                  <th key={app.slug} className="py-2 px-2 text-center">
                    {app.iconUrl ? (
                      <img
                        src={app.iconUrl}
                        alt={app.name}
                        title={app.name}
                        className="h-6 w-6 rounded mx-auto"
                      />
                    ) : (
                      <span className="text-xs">{app.name.charAt(0)}</span>
                    )}
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
                      {cat.category}
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
                          <td className="py-1 pl-4 pr-4">{f.title}</td>
                          {apps.map((app) => (
                            <td
                              key={app.slug}
                              className="py-1 px-2 text-center"
                            >
                              {featurePresence.get(f.handle)?.has(app.slug) ? (
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              ) : (
                                <span className="text-muted-foreground">
                                  —
                                </span>
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
      </CardContent>
    </Card>
  );
}
