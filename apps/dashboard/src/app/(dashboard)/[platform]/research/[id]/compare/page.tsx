"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "@/components/ui/link";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMetadataLimits } from "@appranks/shared";
import type { AppData } from "./types";
import { CompareSection } from "./compare-section";
import { AppSelector } from "./app-selector";
import {
  VerticalListSection,
  AppDetailsSection,
  FeaturesSection,
  SetComparisonSection,
  ReviewsSection,
  CategoryFeaturesSection,
  PricingSection,
  SeoSection,
} from "./sections";

// ─── Section Navigation Config ──────────────────────────────

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

// ─── Main Page ──────────────────────────────────────────────

export default function ResearchComparePage() {
  const params = useParams();
  const { fetchWithAuth } = useAuth();
  const id = params.id as string;

  const platform = params.platform as string;
  const limits = getMetadataLimits(platform);
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
      <AppSelector
        virtualAppSlugs={virtualAppSlugs}
        competitorSlugs={competitorSlugs}
        appDataMap={appDataMap}
        selectedSlugs={selectedSlugs}
        setSelectedSlugs={setSelectedSlugs}
        allSlugs={allSlugs}
      />

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
            <VerticalListSection apps={selectedApps} field="name" max={limits.appName} />
          </CompareSection>

          {/* Subtitle */}
          <CompareSection id="sec-subtitle" title="App Card Subtitle" sectionKey="subtitle" collapsed={!!collapsed["subtitle"]} onToggle={toggleCollapse}>
            <VerticalListSection apps={selectedApps} field="subtitle" max={limits.subtitle} />
          </CompareSection>

          {/* Introduction */}
          <CompareSection id="sec-intro" title="App Introduction" sectionKey="intro" collapsed={!!collapsed["intro"]} onToggle={toggleCollapse}>
            <VerticalListSection apps={selectedApps} field="introduction" max={limits.introduction} />
          </CompareSection>

          {/* App Details */}
          <CompareSection id="sec-details" title="App Details" sectionKey="details" collapsed={!!collapsed["details"]} onToggle={toggleCollapse}>
            <AppDetailsSection apps={selectedApps} detailsMax={limits.details} />
          </CompareSection>

          {/* Features */}
          <CompareSection id="sec-features" title="Features" sectionKey="features" collapsed={!!collapsed["features"]} onToggle={toggleCollapse}>
            <FeaturesSection apps={selectedApps} featureMax={limits.feature} />
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
          {platform !== "canva" && (
            <CompareSection id="sec-seo" title="Web Search Content" sectionKey="seo" collapsed={!!collapsed["seo"]} onToggle={toggleCollapse}>
              <SeoSection apps={selectedApps} seoTitleMax={limits.seoTitle} seoDescMax={limits.seoMetaDescription} />
            </CompareSection>
          )}
        </>
      )}
    </div>
  );
}
