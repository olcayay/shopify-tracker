"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ChevronDown, ChevronUp, ArrowLeft, Star } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────

interface AppData {
  slug: string;
  name: string;
  iconUrl: string | null;
  appCardSubtitle: string | null;
  /** Emoji icon for virtual apps */
  icon?: string;
  /** Hex color for virtual apps */
  color?: string;
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
    averageRating: string | null;
    ratingCount: number | null;
  } | null;
}

// ─── Helpers ─────────────────────────────────────────────────

function CharBadge({ count, max }: { count: number; max?: number }) {
  let colorClass = "border-muted-foreground text-muted-foreground";
  if (max) {
    if (count === 0) {
      colorClass = "border-muted-foreground/50 text-muted-foreground/50";
    } else {
      const pct = count / max;
      if (pct > 1) colorClass = "border-red-600 text-red-600";
      else if (pct >= 0.9) colorClass = "border-green-600 text-green-600";
      else if (pct >= 0.8) colorClass = "border-lime-600 text-lime-600";
      else if (pct >= 0.7) colorClass = "border-yellow-600 text-yellow-600";
      else if (pct >= 0.6) colorClass = "border-orange-500 text-orange-500";
      else colorClass = "border-red-600 text-red-600";
    }
  }
  return (
    <Badge variant="outline" className={cn("text-xs ml-2 shrink-0", colorClass)}>
      {count}{max ? `/${max}` : ""}
    </Badge>
  );
}

const STOP_WORDS = new Set([
  "the","a","an","is","are","am","was","were","be","been","being",
  "in","on","at","to","for","of","and","or","but","not","with",
  "by","from","as","it","its","this","that","these","those",
  "i","you","he","she","we","they","my","your","our","his","her","their",
  "me","us","him","them","do","does","did","have","has","had",
  "will","would","can","could","shall","should","may","might","must",
  "so","if","then","than","no","all","any","each","every","some",
  "such","very","just","about","up","out","how","what","which","who",
  "when","where","also","more","other","into","over","after","before",
]);

function useKeywordDensity(text: string) {
  return useMemo(() => {
    const words = text.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter(Boolean);
    const totalWords = words.length;
    if (totalWords === 0) return [];
    const counts = new Map<string, number>();
    for (const w of words) {
      if (w.length < 2 || STOP_WORDS.has(w)) continue;
      counts.set(w, (counts.get(w) || 0) + 1);
    }
    for (let i = 0; i < words.length - 1; i++) {
      if (STOP_WORDS.has(words[i]) || STOP_WORDS.has(words[i + 1])) continue;
      if (words[i].length < 2 || words[i + 1].length < 2) continue;
      const phrase = `${words[i]} ${words[i + 1]}`;
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
    }
    for (let i = 0; i < words.length - 2; i++) {
      if (STOP_WORDS.has(words[i]) || STOP_WORDS.has(words[i + 2])) continue;
      if (words[i].length < 2 || words[i + 2].length < 2) continue;
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 30)
      .map(([keyword, count]) => ({
        keyword,
        count,
        n: keyword.split(" ").length as 1 | 2 | 3,
        density: ((count / totalWords) * 100).toFixed(2),
      }));
  }, [text]);
}

const N_GRAM_COLORS = {
  1: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  2: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  3: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
} as const;

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.min(Math.max(rating - star + 1, 0), 1);
        return (
          <Star
            key={star}
            className={cn("h-4 w-4", fill >= 0.5 ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30")}
          />
        );
      })}
    </div>
  );
}

// ─── Collapsible Section ─────────────────────────────────────

function CompareSection({
  id, title, sectionKey, collapsed, onToggle, children,
}: {
  id: string; title: string; sectionKey: string; collapsed: boolean;
  onToggle: (key: string) => void; children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader
        className="pb-0 cursor-pointer select-none"
        onClick={() => onToggle(sectionKey)}
      >
        <CardTitle className="flex items-center justify-between text-sm">
          {title}
          {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      {!collapsed && <CardContent className="pt-3">{children}</CardContent>}
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────

export default function ResearchComparePage() {
  const params = useParams();
  const { fetchWithAuth } = useAuth();
  const id = params.id as string;

  const platform = params.platform as string;
  const [projectName, setProjectName] = useState("");
  const [competitorSlugs, setCompetitorSlugs] = useState<string[]>([]);
  const [virtualAppSlugs, setVirtualAppSlugs] = useState<string[]>([]);
  const [appDataMap, setAppDataMap] = useState<Map<string, AppData>>(new Map());
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem("research-compare-collapsed") || "{}");
    } catch { return {}; }
  });

  const toggleCollapse = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("research-compare-collapsed", JSON.stringify(next));
      return next;
    });
  }, []);

  // 1. Load research project to get competitor list + virtual apps
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth(`/api/research-projects/${id}/data`);
        if (!res.ok) return;
        const data = await res.json();
        setProjectName(data.project.name);
        const slugs = data.competitors.map((c: any) => c.slug);
        setCompetitorSlugs(slugs);

        // Convert virtual apps to AppData format with __virtual__ prefix
        const vaSlugs: string[] = [];
        const vaEntries: [string, AppData][] = [];
        for (const va of data.virtualApps || []) {
          const vaSlug = `__virtual__${va.id}`;
          vaSlugs.push(vaSlug);
          vaEntries.push([vaSlug, {
            slug: vaSlug,
            name: va.name,
            iconUrl: va.iconUrl,
            icon: va.icon || "🚀",
            color: va.color || "#3B82F6",
            appCardSubtitle: va.appCardSubtitle || null,
            latestSnapshot: {
              appIntroduction: va.appIntroduction || "",
              appDetails: va.appDetails || "",
              features: va.features || [],
              languages: va.languages || [],
              integrations: va.integrations || [],
              pricingPlans: va.pricingPlans || [],
              categories: va.categories || [],
              seoTitle: va.seoTitle || "",
              seoMetaDescription: va.seoMetaDescription || "",
              averageRating: null,
              ratingCount: null,
            },
          }]);
        }
        setVirtualAppSlugs(vaSlugs);
        setSelectedSlugs(new Set([...vaSlugs, ...slugs]));

        // 2. Fetch individual app data for each competitor
        const entries = await Promise.all(
          slugs.map(async (slug: string) => {
            try {
              const appRes = await fetchWithAuth(`/api/apps/${slug}`);
              if (appRes.ok) {
                const appData: AppData = await appRes.json();
                return [slug, appData] as [string, AppData];
              }
            } catch { /* skip */ }
            return null;
          })
        );
        const map = new Map<string, AppData>();
        for (const entry of vaEntries) {
          map.set(entry[0], entry[1]);
        }
        for (const entry of entries) {
          if (entry) map.set(entry[0], entry[1]);
        }
        setAppDataMap(map);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, fetchWithAuth]);

  const allSlugs = useMemo(() => [...virtualAppSlugs, ...competitorSlugs], [virtualAppSlugs, competitorSlugs]);

  const selectedApps = useMemo(
    () => allSlugs.filter((s) => selectedSlugs.has(s)).map((s) => appDataMap.get(s)).filter(Boolean) as AppData[],
    [allSlugs, selectedSlugs, appDataMap]
  );

  const isVirtualApp = useCallback((slug: string) => slug.startsWith("__virtual__"), []);

  // Section navigation
  const SECTIONS = [
    { id: "sec-name", key: "name", label: "Name" },
    { id: "sec-subtitle", key: "subtitle", label: "Subtitle" },
    { id: "sec-intro", key: "intro", label: "Introduction" },
    { id: "sec-details", key: "details", label: "Details" },
    { id: "sec-features", key: "features", label: "Features" },
    { id: "sec-languages", key: "languages", label: "Languages" },
    { id: "sec-integrations", key: "integrations", label: "Integrations" },
    { id: "sec-reviews", key: "reviews", label: "Reviews" },
    { id: "sec-catfeatures", key: "catfeatures", label: "Category Features" },
    { id: "sec-pricing", key: "pricing", label: "Pricing" },
    { id: "sec-seo", key: "seo", label: "Web Search" },
  ] as const;

  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);
  const navRef = useRef<HTMLDivElement>(null);

  // Intersection observer for active section tracking
  useEffect(() => {
    if (selectedApps.length === 0) return;
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          // Pick the one closest to the top
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, [selectedApps.length]);

  function scrollToSection(sectionId: string) {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(sectionId);
    }
    // Also auto-scroll nav pill into view
    setTimeout(() => {
      const pill = document.getElementById(`nav-${sectionId}`);
      pill?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }, 100);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/research/${id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{projectName}</h1>
          <p className="text-sm text-muted-foreground">Compare Competitors</p>
        </div>
        <Badge variant="secondary">{selectedApps.length} of {allSlugs.length} selected</Badge>
      </div>

      {/* App Selector */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Virtual apps first */}
            {virtualAppSlugs.map((slug) => {
              const app = appDataMap.get(slug);
              if (!app) return null;
              const isSelected = selectedSlugs.has(slug);
              const color = app.color || "#3B82F6";
              return (
                <div key={slug} className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => {
                      setSelectedSlugs((prev) => {
                        const next = new Set(prev);
                        if (next.has(slug)) next.delete(slug);
                        else next.add(slug);
                        return next;
                      });
                    }}
                    className={cn(
                      "relative rounded-lg transition-all shrink-0 h-10 w-10",
                      isSelected
                        ? "ring-2 ring-offset-2 ring-offset-background"
                        : "opacity-35 hover:opacity-60"
                    )}
                    style={isSelected ? { ["--tw-ring-color" as any]: color } : undefined}
                  >
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <span className="text-lg">{app.icon || "🚀"}</span>
                    </div>
                    {isSelected && (
                      <div
                        className="absolute -top-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: color }}
                      >
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </button>
                  <span className="text-[10px] font-medium whitespace-nowrap" style={{ color }}>
                    {app.name}
                  </span>
                </div>
              );
            })}
            {virtualAppSlugs.length > 0 && competitorSlugs.length > 0 && (
              <div className="border-l h-8 mx-1" />
            )}
            {/* Competitors */}
            {competitorSlugs.map((slug) => {
              const app = appDataMap.get(slug);
              if (!app) return null;
              const isSelected = selectedSlugs.has(slug);
              return (
                <div key={slug} className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => {
                      setSelectedSlugs((prev) => {
                        const next = new Set(prev);
                        if (next.has(slug)) next.delete(slug);
                        else next.add(slug);
                        return next;
                      });
                    }}
                    className={cn(
                      "relative rounded-lg transition-all shrink-0 h-10 w-10",
                      isSelected
                        ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background"
                        : "opacity-35 hover:opacity-60 grayscale hover:grayscale-0"
                    )}
                  >
                    {app.iconUrl ? (
                      <img src={app.iconUrl} alt={app.name} className="h-10 w-10 rounded-lg" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold">
                        {app.name.charAt(0)}
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </button>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap max-w-[60px] truncate">
                    {app.name.split(/\s/)[0]}
                  </span>
                </div>
              );
            })}
            <div className="border-l h-8 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (selectedSlugs.size === allSlugs.length) setSelectedSlugs(new Set());
                else setSelectedSlugs(new Set(allSlugs));
              }}
              className="text-xs"
            >
              {selectedSlugs.size === allSlugs.length ? "Deselect all" : "Select all"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedApps.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Select at least one competitor to compare.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Sticky section nav */}
          <div
            ref={navRef}
            className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b -mx-4 px-4 py-2"
          >
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  id={`nav-${s.id}`}
                  onClick={() => scrollToSection(s.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0",
                    activeSection === s.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* App Name */}
          <CompareSection id="sec-name" title="App Name" sectionKey="name" collapsed={!!collapsed["name"]} onToggle={toggleCollapse}>
            <VerticalListSection apps={selectedApps} field="name" max={30} />
          </CompareSection>

          {/* Subtitle */}
          <CompareSection id="sec-subtitle" title="App Card Subtitle" sectionKey="subtitle" collapsed={!!collapsed["subtitle"]} onToggle={toggleCollapse}>
            <VerticalListSection apps={selectedApps} field="subtitle" max={62} />
          </CompareSection>

          {/* Introduction */}
          <CompareSection id="sec-intro" title="App Introduction" sectionKey="intro" collapsed={!!collapsed["intro"]} onToggle={toggleCollapse}>
            <VerticalListSection apps={selectedApps} field="introduction" max={100} />
          </CompareSection>

          {/* App Details */}
          <CompareSection id="sec-details" title="App Details" sectionKey="details" collapsed={!!collapsed["details"]} onToggle={toggleCollapse}>
            <AppDetailsSection apps={selectedApps} />
          </CompareSection>

          {/* Features */}
          <CompareSection id="sec-features" title="Features" sectionKey="features" collapsed={!!collapsed["features"]} onToggle={toggleCollapse}>
            <FeaturesSection apps={selectedApps} />
          </CompareSection>

          {/* Languages */}
          <CompareSection id="sec-languages" title="Languages" sectionKey="languages" collapsed={!!collapsed["languages"]} onToggle={toggleCollapse}>
            <SetComparisonSection apps={selectedApps} field="languages" />
          </CompareSection>

          {/* Integrations */}
          <CompareSection id="sec-integrations" title="Integrations" sectionKey="integrations" collapsed={!!collapsed["integrations"]} onToggle={toggleCollapse}>
            <SetComparisonSection apps={selectedApps} field="integrations" linkPrefix="/integrations/" />
          </CompareSection>

          {/* Reviews and Ratings */}
          <CompareSection id="sec-reviews" title="Reviews and Ratings" sectionKey="reviews" collapsed={!!collapsed["reviews"]} onToggle={toggleCollapse}>
            <ReviewsSection apps={selectedApps} />
          </CompareSection>

          {/* Category Features */}
          <CompareSection id="sec-catfeatures" title="Category Features" sectionKey="catfeatures" collapsed={!!collapsed["catfeatures"]} onToggle={toggleCollapse}>
            <CategoryFeaturesSection apps={selectedApps} />
          </CompareSection>

          {/* Pricing */}
          <CompareSection id="sec-pricing" title="Pricing Plans" sectionKey="pricing" collapsed={!!collapsed["pricing"]} onToggle={toggleCollapse}>
            <PricingSection apps={selectedApps} />
          </CompareSection>

          {/* SEO */}
          <CompareSection id="sec-seo" title="Web Search Content" sectionKey="seo" collapsed={!!collapsed["seo"]} onToggle={toggleCollapse}>
            <SeoSection apps={selectedApps} />
          </CompareSection>
        </>
      )}
    </div>
  );
}

// ─── Vertical List (Name / Subtitle / Intro) ────────────────

function getAppLink(slug: string, id: string) {
  if (slug.startsWith("__virtual__")) {
    const vaId = slug.replace("__virtual__", "");
    return `/research/${id}/virtual-apps/${vaId}`;
  }
  return `/apps/${slug}`;
}

function AppIcon({ app, size = "sm" }: { app: AppData; size?: "sm" | "md" }) {
  const isVirtual = app.slug.startsWith("__virtual__");
  const dim = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  const emojiSize = size === "sm" ? "text-sm" : "text-base";
  if (isVirtual) {
    const color = app.color || "#3B82F6";
    return (
      <div
        className={cn(dim, "rounded flex items-center justify-center")}
        style={{ backgroundColor: `${color}20` }}
      >
        <span className={emojiSize}>{app.icon || "🚀"}</span>
      </div>
    );
  }
  if (app.iconUrl) {
    return <img src={app.iconUrl} alt="" className={cn(dim, "rounded")} />;
  }
  return <div className={cn(dim, "rounded bg-muted flex items-center justify-center text-xs font-bold")}>{app.name.charAt(0)}</div>;
}

function VerticalListSection({
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

function AppDetailsSection({ apps }: { apps: AppData[] }) {
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
            <CharBadge count={text.length} max={500} />
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
    <div className="border rounded-md overflow-hidden max-h-60 overflow-y-auto">
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

function FeaturesSection({ apps }: { apps: AppData[] }) {
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
                          <CharBadge count={feat.length} max={80} />
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

function SetComparisonSection({
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

function ReviewsSection({ apps }: { apps: AppData[] }) {
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
                    {app.latestSnapshot.ratingCount.toLocaleString()}
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

function CategoryFeaturesSection({ apps }: { apps: AppData[] }) {
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

function PricingSection({ apps }: { apps: AppData[] }) {
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

function SeoSection({ apps }: { apps: AppData[] }) {
  const { id } = useParams();
  return (
    <div className="space-y-4">
      <div>
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
                <CharBadge count={title.length} max={60} />
              </div>
            );
          })}
        </div>
      </div>
      <div>
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
                <CharBadge count={desc.length} max={160} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
