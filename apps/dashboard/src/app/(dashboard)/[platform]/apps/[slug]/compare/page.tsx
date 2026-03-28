"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getMetadataLimits } from "@/lib/metadata-limits";
import { CardSkeleton } from "@/components/skeletons";

import { useCompareData } from "./use-compare-data";
import { AppIcon } from "./app-icon";
import { CharBadge } from "./char-badge";
import { DraftInput } from "./draft-input";
import { VerticalListSection } from "./compare-section";
import { DetailsSection } from "./details-section";
import { FeaturesSection } from "./features-section";
import { BadgeComparisonSection } from "./badge-comparison-section";
import { PermissionsComparisonSection } from "./permissions-comparison-section";
import { PricingComparison } from "./pricing-comparison";
import { CategoryRankingSection } from "./category-ranking-section";
import { ReviewsRatingsSection } from "./reviews-ratings-section";
import { CategoriesComparison } from "./categories-comparison";
import { WixFeaturedSection } from "./wix-featured-section";

export default function ComparePage() {
  const params = useParams<{ platform: string; slug: string }>();
  const { platform, slug } = params;

  const {
    mainApp,
    competitors,
    setCompetitors,
    selectedSlugs,
    rankingsData,
    loading,
    activeDetailSlug,
    setActiveDetailSlug,
    selectedApps,
    toggleCompetitor,
    toggleAll,
    fetchWithAuth,
  } = useCompareData(slug);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftSubtitle, setDraftSubtitle] = useState("");
  const [draftIntro, setDraftIntro] = useState("");

  // Collapsible sections — persisted globally
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => {
      try {
        const saved = localStorage.getItem("compare-collapsed");
        return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch {
        return new Set();
      }
    }
  );

  useEffect(() => {
    localStorage.setItem(
      "compare-collapsed",
      JSON.stringify([...collapsedSections])
    );
  }, [collapsedSections]);

  const isSalesforce = platform === "salesforce";
  const isCanva = platform === "canva";
  const isWix = platform === "wix";
  const isWordPress = platform === "wordpress";
  const isGoogleWorkspace = platform === "google_workspace";
  const isHubSpot = platform === "hubspot";
  const limits = getMetadataLimits(platform);

  // Section navigation
  const SECTIONS = useMemo(() => {
    const sections = [
      { id: "sec-name", key: "appName", label: "Name" },
      { id: "sec-subtitle", key: "appCardSubtitle", label: isCanva || isWix ? "Tagline" : isWordPress || isGoogleWorkspace || isHubSpot ? "Short Description" : "Subtitle" },
      { id: "sec-intro", key: "appIntroduction", label: isCanva || isWix || isWordPress || isGoogleWorkspace || isHubSpot ? "Short Description" : "Introduction" },
      { id: "sec-details", key: "appDetails", label: isCanva || isWix || isWordPress || isGoogleWorkspace || isHubSpot ? "Description" : "Details" },
    ];
    if (!isCanva) {
      sections.push({ id: "sec-features", key: "features", label: "Features" });
    }
    sections.push(
      { id: "sec-languages", key: "languages", label: "Languages" },
      { id: "sec-integrations", key: "integrations", label: isSalesforce ? "Compatible With" : "Integrations" },
    );
    if (isSalesforce) {
      sections.push(
        { id: "sec-industries", key: "industries", label: "Industries" },
        { id: "sec-requires", key: "requires", label: "Requires" },
      );
    }
    if (isCanva) {
      sections.push(
        { id: "sec-permissions", key: "permissions", label: "Permissions" },
      );
    }
    sections.push(
      { id: "sec-rankings", key: "categoryRanking", label: "Rankings" },
    );
    if (!isCanva) {
      sections.push(
        { id: "sec-reviews", key: "reviewsRatings", label: "Reviews" },
        { id: "sec-catfeatures", key: "categoriesFeatures", label: "Category Features" },
        { id: "sec-pricing", key: "pricingPlans", label: "Pricing" },
        { id: "sec-seo", key: "webSearchContent", label: "Web Search" },
      );
    }
    return sections;
  }, [isSalesforce, isCanva, isWix, isWordPress, isGoogleWorkspace, isHubSpot]);

  const [activeSection, setActiveSection] = useState<string>("sec-name");
  const navRef = useRef<HTMLDivElement>(null);

  // Intersection observer for active section tracking
  useEffect(() => {
    if (!mainApp || selectedSlugs.size <= 1) return;
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, [mainApp, selectedSlugs.size, SECTIONS]);

  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(sectionId);
    }
    setTimeout(() => {
      const pill = document.getElementById(`nav-${sectionId}`);
      pill?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }, 100);
  }, []);

  function toggleSection(key: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleDragStart(index: number) { setDragIndex(index); }
  function handleDragOver(e: React.DragEvent, index: number) { e.preventDefault(); setDragOverIndex(index); }
  function handleDragEnd() { setDragIndex(null); setDragOverIndex(null); }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newList = [...competitors];
    const [moved] = newList.splice(dragIndex, 1);
    newList.splice(targetIndex, 0, moved);
    setCompetitors(newList);
    setDragIndex(null);
    setDragOverIndex(null);
    const slugs = newList.map((c) => c.slug);
    fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(slug)}/competitors/reorder`,
      { method: "PATCH", body: JSON.stringify({ slugs }) }
    );
  }

  const isCollapsed = (key: string) => collapsedSections.has(key);

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={6} />
        <CardSkeleton lines={4} />
      </div>
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
          <div className="flex items-center gap-3 flex-wrap pb-4">
            <AppIcon app={{ slug: mainApp.slug, name: mainApp.name, iconUrl: mainApp.iconUrl }} selected isMain />
            <div className="w-px h-8 bg-border" />
            {competitors.map((c, idx) => (
              <div
                key={c.slug}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "relative cursor-grab active:cursor-grabbing transition-all",
                  dragIndex === idx && "opacity-30",
                  dragOverIndex === idx && dragIndex !== idx && "scale-110"
                )}
              >
                {dragOverIndex === idx && dragIndex !== null && dragIndex !== idx && (
                  <div className={cn("absolute top-0 bottom-0 w-0.5 bg-emerald-500 z-10", dragIndex > idx ? "-left-1.5" : "-right-1.5")} />
                )}
                <AppIcon app={c} selected={selectedSlugs.has(c.slug)} onClick={() => toggleCompetitor(c.slug)} />
              </div>
            ))}
            <button onClick={toggleAll} className="text-xs text-muted-foreground hover:text-foreground ml-2 transition-colors">
              {selectedSlugs.size === competitors.length ? "Deselect all" : "Select all"}
            </button>
          </div>
        </CardContent>
      </Card>

      {selectedApps.length <= 1 && (
        <p className="text-muted-foreground text-center py-4 text-sm">Select at least one competitor to compare.</p>
      )}

      {selectedApps.length > 1 && (
        <>
          {/* Sticky section nav */}
          <div ref={navRef} className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b -mx-4 px-4 py-2">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  id={`nav-${s.id}`}
                  onClick={() => scrollToSection(s.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0",
                    activeSection === s.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* App Name */}
          <VerticalListSection id="sec-name" title="App Name" sectionKey="appName" collapsed={isCollapsed("appName")} onToggle={toggleSection} apps={selectedApps} mainSlug={mainApp.slug}
            header={<DraftInput value={draftName} onChange={setDraftName} max={limits.appName} placeholder="Test a new App Name!" />}
          >
            {(app) => (
              <div className="flex items-center">
                <span className="text-sm font-medium flex-1 min-w-0">{app.name}</span>
                <CharBadge count={app.name.length} max={limits.appName} />
              </div>
            )}
          </VerticalListSection>

          {/* App Card Subtitle / Tagline */}
          <VerticalListSection id="sec-subtitle" title={isCanva || isWix ? "Tagline" : isWordPress || isGoogleWorkspace || isHubSpot ? "Short Description" : "App Card Subtitle"} sectionKey="appCardSubtitle" collapsed={isCollapsed("appCardSubtitle")} onToggle={toggleSection} apps={selectedApps} mainSlug={mainApp.slug}
            header={<DraftInput value={draftSubtitle} onChange={setDraftSubtitle} max={limits.subtitle} placeholder={isCanva || isWix ? "Test a new Tagline!" : isWordPress || isGoogleWorkspace || isHubSpot ? "Test a new Short Description!" : "Test a new Subtitle!"} />}
          >
            {(app) => (
              <div className="flex items-center">
                <span className="text-sm flex-1 min-w-0">{app.appCardSubtitle || "—"}</span>
                {app.appCardSubtitle && <CharBadge count={app.appCardSubtitle.length} max={limits.subtitle} />}
              </div>
            )}
          </VerticalListSection>

          {/* App Introduction / Short Description */}
          <VerticalListSection id="sec-intro" title={isCanva || isWix || isWordPress || isGoogleWorkspace || isHubSpot ? "Short Description" : "App Introduction"} sectionKey="appIntroduction" collapsed={isCollapsed("appIntroduction")} onToggle={toggleSection} apps={selectedApps} mainSlug={mainApp.slug}
            header={<DraftInput value={draftIntro} onChange={setDraftIntro} max={limits.introduction} placeholder={isCanva || isWix || isWordPress || isGoogleWorkspace || isHubSpot ? "Test a new Short Description!" : "Test a new Introduction!"} />}
          >
            {(app) => (
              <div>
                <div className="flex items-start gap-2">
                  <p className="text-sm flex-1">{app.latestSnapshot?.appIntroduction || "—"}</p>
                  {app.latestSnapshot?.appIntroduction && <CharBadge count={app.latestSnapshot.appIntroduction.length} max={limits.introduction} />}
                </div>
              </div>
            )}
          </VerticalListSection>

          {/* App Details / Description */}
          <DetailsSection id="sec-details" sectionKey="appDetails" collapsed={isCollapsed("appDetails")} onToggle={toggleSection} apps={selectedApps} activeDetailSlug={activeDetailSlug} onActiveDetailSlugChange={setActiveDetailSlug} detailsCharLimit={limits.details} title={isCanva || isWix || isWordPress || isGoogleWorkspace || isHubSpot ? "Description" : "App Details"} />

          {/* Features / Highlights */}
          {!isCanva && <FeaturesSection id="sec-features" sectionKey="features" collapsed={isCollapsed("features")} onToggle={toggleSection} apps={selectedApps} isSalesforce={isSalesforce} isWix={isWix} featureCharLimit={limits.feature} />}

          {/* Languages */}
          <BadgeComparisonSection id="sec-languages" title="Languages" sectionKey="languages" collapsed={isCollapsed("languages")} onToggle={toggleSection} apps={selectedApps} getItems={(app) => app.latestSnapshot?.languages || []} />

          {/* Integrations / Compatible With */}
          <BadgeComparisonSection id="sec-integrations" title={isSalesforce ? "Compatible With" : "Integrations"} sectionKey="integrations" collapsed={isCollapsed("integrations")} onToggle={toggleSection} apps={selectedApps} getItems={(app) => app.latestSnapshot?.integrations || []} linkPrefix={`/${platform}/integrations`} />

          {/* Salesforce: Industries & Requires */}
          {isSalesforce && (
            <>
              <BadgeComparisonSection id="sec-industries" title="Industries" sectionKey="industries" collapsed={isCollapsed("industries")} onToggle={toggleSection} apps={selectedApps} getItems={(app) => app.latestSnapshot?.platformData?.supportedIndustries || []} linkPrefix={`/${platform}/discover/industry`} />
              <BadgeComparisonSection id="sec-requires" title="Requires" sectionKey="requires" collapsed={isCollapsed("requires")} onToggle={toggleSection} apps={selectedApps} getItems={(app) => app.latestSnapshot?.platformData?.productsRequired || []} linkPrefix={`/${platform}/discover/product-required`} />
            </>
          )}

          {/* Canva: Permissions */}
          {isCanva && <PermissionsComparisonSection id="sec-permissions" sectionKey="permissions" collapsed={isCollapsed("permissions")} onToggle={toggleSection} apps={selectedApps} />}

          {/* Category Ranking */}
          <CategoryRankingSection id="sec-rankings" sectionKey="categoryRanking" collapsed={isCollapsed("categoryRanking")} onToggle={toggleSection} apps={selectedApps} rankingsData={rankingsData} />

          {/* Reviews and Ratings */}
          <ReviewsRatingsSection id="sec-reviews" sectionKey="reviewsRatings" collapsed={isCollapsed("reviewsRatings")} onToggle={toggleSection} apps={selectedApps} />

          {/* Categories & Features */}
          <CategoriesComparison id="sec-catfeatures" sectionKey="categoriesFeatures" collapsed={isCollapsed("categoriesFeatures")} onToggle={toggleSection} apps={selectedApps} />

          {/* Wix Featured In (Collections) */}
          {isWix && <WixFeaturedSection id="sec-featured-in" sectionKey="featuredIn" collapsed={isCollapsed("featuredIn")} onToggle={toggleSection} apps={selectedApps} />}

          {/* Pricing Plans */}
          <PricingComparison id="sec-pricing" sectionKey="pricingPlans" collapsed={isCollapsed("pricingPlans")} onToggle={toggleSection} apps={selectedApps} />

          {/* Web Search Content */}
          {!isCanva && <VerticalListSection id="sec-seo" title="Web Search Content" sectionKey="webSearchContent" collapsed={isCollapsed("webSearchContent")} onToggle={toggleSection} apps={selectedApps} mainSlug={mainApp.slug}>
            {(app) => {
              const s = app.latestSnapshot;
              if (!s?.seoTitle && !s?.seoMetaDescription) return <span className="text-sm text-muted-foreground">—</span>;
              return (
                <div className="space-y-2">
                  {s?.seoTitle && (
                    <div>
                      <div className="flex items-center">
                        <span className="text-xs text-muted-foreground flex-1">Title Tag</span>
                        <CharBadge count={s.seoTitle.length} max={limits.seoTitle} />
                      </div>
                      <p className="text-sm mt-0.5">{s.seoTitle}</p>
                    </div>
                  )}
                  {s?.seoMetaDescription && (
                    <div>
                      <div className="flex items-center">
                        <span className="text-xs text-muted-foreground flex-1">Meta Description</span>
                        <CharBadge count={s.seoMetaDescription.length} max={limits.seoMetaDescription} />
                      </div>
                      <p className="text-sm mt-0.5">{s.seoMetaDescription}</p>
                    </div>
                  )}
                </div>
              );
            }}
          </VerticalListSection>}
        </>
      )}
    </div>
  );
}
