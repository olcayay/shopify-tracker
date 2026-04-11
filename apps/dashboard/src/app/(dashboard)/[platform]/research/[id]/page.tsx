"use client";

import { useEffect, useState, useCallback } from "react";
import { usePolling } from "@/hooks/use-polling";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useFeatureFlag } from "@/contexts/feature-flags-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  X,
  ArrowLeft,
  Pencil,
  Check,
  Users,
  Lightbulb,
  BarChart3,
  LayoutGrid,
  Puzzle,
  TrendingUp,
  Type,
  GitCompareArrows,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import type { ResearchData } from "./research-types";
import { SectionWrapper } from "./section-wrapper";
import { SummaryCards } from "./research-summary";
import { KeywordsSection, KeywordSuggestions } from "./research-keywords-panel";
import { CompetitorTable, CompetitorSuggestions, InlineAppSearch, ManualAppSearch } from "./research-competitors-panel";
import { MarketLanguage } from "./research-word-analysis";
import { CategoryLandscape } from "./research-categories";
import { FeatureCoverage } from "./research-features";
import { OpportunityTable } from "./research-opportunities";
import { GenerateVirtualAppsButton, CreateVirtualAppButton, VirtualAppsGrid } from "./research-virtual-apps";

// ─── Main Page ───────────────────────────────────────────────

export default function ResearchProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { fetchWithAuth, user } = useAuth();

  const id = params.id as string;
  const platform = params.platform as string;
  const canEdit = user?.role === "owner" || user?.role === "admin" || user?.role === "editor";
  const hasKeywordScore = useFeatureFlag("keyword-score");

  const [data, setData] = useState<ResearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Polling
  const [pendingKeywords, setPendingKeywords] = useState<Set<number>>(new Set());
  const [pendingCompetitors, setPendingCompetitors] = useState<Set<string>>(new Set());
  const [resolvedKeywords, setResolvedKeywords] = useState<Set<number>>(new Set());
  const [resolvedCompetitors, setResolvedCompetitors] = useState<Set<string>>(new Set());
  // Editing project name
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/research-projects/${id}/data`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Project not found");
          return;
        }
        throw new Error("Failed to load");
      }
      const newData: ResearchData = await res.json();
      setData(newData);
      setError(null);

      // Clear pending items that have been resolved → move to resolved set
      setPendingKeywords((prev) => {
        const next = new Set(prev);
        const justResolved: number[] = [];
        for (const kwId of prev) {
          const kw = newData.keywords.find((k) => k.id === kwId);
          if (kw?.scrapedAt) {
            next.delete(kwId);
            justResolved.push(kwId);
          }
        }
        if (justResolved.length > 0) {
          setResolvedKeywords((r) => {
            const n = new Set(r);
            justResolved.forEach((id) => n.add(id));
            return n;
          });
          setTimeout(() => {
            setResolvedKeywords((r) => {
              const n = new Set(r);
              justResolved.forEach((id) => n.delete(id));
              return n;
            });
          }, 2000);
        }
        return next;
      });
      setPendingCompetitors((prev) => {
        const next = new Set(prev);
        const justResolved: string[] = [];
        for (const slug of prev) {
          const comp = newData.competitors.find((c) => c.slug === slug);
          if (comp?.averageRating != null) {
            next.delete(slug);
            justResolved.push(slug);
          }
        }
        if (justResolved.length > 0) {
          setResolvedCompetitors((r) => {
            const n = new Set(r);
            justResolved.forEach((s) => n.add(s));
            return n;
          });
          setTimeout(() => {
            setResolvedCompetitors((r) => {
              const n = new Set(r);
              justResolved.forEach((s) => n.delete(s));
              return n;
            });
          }, 2000);
        }
        return next;
      });
    } catch {
      setError("Failed to load project data");
    } finally {
      setLoading(false);
    }
  }, [id, fetchWithAuth]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling when pending items exist
  usePolling({
    hasPending: pendingKeywords.size > 0 || pendingCompetitors.size > 0,
    fetchFn: fetchData,
  });

  // Name editing
  async function saveName() {
    if (!nameValue.trim() || !data) return;
    const res = await fetchWithAuth(`/api/research-projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameValue.trim() }),
    });
    if (res.ok) {
      setData((prev) => prev ? { ...prev, project: { ...prev.project, name: nameValue.trim() } } : prev);
    }
    setEditingName(false);
  }

  // ─── Callbacks ──────────────────────────────────────────────

  const addKeyword = useCallback(async (keyword: string) => {
    const res = await fetchWithAuth(`/api/research-projects/${id}/keywords`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    });
    if (res.ok) {
      const result = await res.json();
      if (result.scraperEnqueued) {
        setPendingKeywords((prev) => new Set(prev).add(result.keywordId));
      }
      await fetchData();
    }
  }, [id, fetchWithAuth, fetchData]);

  const removeKeyword = useCallback(async (kwId: number) => {
    const res = await fetchWithAuth(`/api/research-projects/${id}/keywords/${kwId}`, {
      method: "DELETE",
    });
    if (res.ok) await fetchData();
  }, [id, fetchWithAuth, fetchData]);

  const addCompetitor = useCallback(async (slug: string) => {
    const res = await fetchWithAuth(`/api/research-projects/${id}/competitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (res.ok) {
      const result = await res.json();
      if (result.scraperEnqueued) {
        setPendingCompetitors((prev) => new Set(prev).add(slug));
      }
      await fetchData();
    }
  }, [id, fetchWithAuth, fetchData]);

  const removeCompetitor = useCallback(async (slug: string) => {
    const res = await fetchWithAuth(`/api/research-projects/${id}/competitors/${slug}`, {
      method: "DELETE",
    });
    if (res.ok) await fetchData();
  }, [id, fetchWithAuth, fetchData]);

  // ─── Render ─────────────────────────────────────────────────

  const hasKeywords = (data?.keywords.length ?? 0) > 0;
  const hasCompetitors = (data?.competitors.length ?? 0) > 0;
  const hasRichData = (data?.keywords.length ?? 0) >= 3 && (data?.competitors.length ?? 0) >= 2;

  if (loading) {
    return (
      <div className="space-y-6" aria-live="polite" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground mb-4">{error || "Project not found"}</p>
        <Button variant="outline" onClick={() => router.push(`/${platform}/research`)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/${platform}/research`} className="text-muted-foreground hover:text-foreground" aria-label="Back to research projects">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                className="text-xl font-bold h-auto py-1"
                autoFocus
              />
              <Button size="sm" variant="ghost" onClick={saveName} aria-label="Save project name"><Check className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingName(false)} aria-label="Cancel editing"><X className="h-4 w-4" /></Button>
            </div>
          ) : (
            <button
              onClick={() => { if (canEdit) { setNameValue(data.project.name); setEditingName(true); } }}
              className="flex items-center gap-2 group"
              aria-label={canEdit ? "Edit project name" : undefined}
            >
              <h1 className="text-2xl font-bold truncate">{data.project.name}</h1>
              {canEdit && <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/${platform}/research/${id}/keywords`}>
            <Button variant="outline" size="sm">
              <Search className="h-3.5 w-3.5 mr-1.5" />
              {data.keywords.length} Keywords
            </Button>
          </Link>
          <Link href={`/${platform}/research/${id}/competitors`}>
            <Button variant="outline" size="sm">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              {data.competitors.length} Competitors
            </Button>
          </Link>
          {hasCompetitors && (
            <Link href={`/${platform}/research/${id}/compare`}>
              <Button variant="outline" size="sm">
                <GitCompareArrows className="h-3.5 w-3.5 mr-1.5" />
                Compare
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards data={data} />

      {/* Virtual Apps */}
      {hasCompetitors && (
        <SectionWrapper
          id="section-virtual-apps"
          title="Virtual Apps"
          icon={Sparkles}
          count={data.virtualApps?.length ?? 0}
          subtitle="Design your app by picking features from competitors"
          headerAction={canEdit ? (
            <div className="flex items-center gap-2">
              <GenerateVirtualAppsButton projectId={id} competitorCount={data.competitors?.length ?? 0} onGenerated={fetchData} />
              <CreateVirtualAppButton projectId={id} />
            </div>
          ) : undefined}
        >
          <VirtualAppsGrid
            virtualApps={data.virtualApps || []}
            projectId={id}
            canEdit={canEdit}
            fetchWithAuth={fetchWithAuth}
            onDelete={fetchData}
          />
        </SectionWrapper>
      )}

      {/* Keywords Section */}
      <KeywordsSection
        projectId={id}
        data={data}
        canEdit={canEdit}
        pendingKeywords={pendingKeywords}
        resolvedKeywords={resolvedKeywords}
        onAdd={addKeyword}
        onRemove={removeKeyword}
      />

      {/* Competitor Table */}
      {hasCompetitors && (
        <SectionWrapper
          id="section-competitors"
          title="Your Competitors"
          icon={BarChart3}
          count={data.competitors.length}
          titleHref={`/research/${id}/competitors`}
          headerAction={canEdit ? (
            <InlineAppSearch
              fetchWithAuth={fetchWithAuth}
              existingSlugs={new Set(data.competitors.map((c) => c.slug))}
              onAdd={addCompetitor}
            />
          ) : undefined}
        >
          <CompetitorTable
            competitors={data.competitors}
            keywordRankings={data.keywordRankings}
            keywords={data.keywords}
            pendingCompetitors={pendingCompetitors}
            resolvedCompetitors={resolvedCompetitors}
            canEdit={canEdit}
            onRemove={removeCompetitor}
          />
        </SectionWrapper>
      )}

      {/* Competitor Suggestions */}
      {hasKeywords && data.competitorSuggestions.length > 0 && (
        <SectionWrapper id="section-competitor-suggestions" title="Competitor Suggestions" icon={Users} subtitle="Apps that rank for your keywords">
          <CompetitorSuggestions
            suggestions={data.competitorSuggestions}
            canEdit={canEdit}
            onAdd={addCompetitor}
          />
        </SectionWrapper>
      )}

      {/* Manual app search (when no competitors yet) */}
      {!hasCompetitors && hasKeywords && canEdit && (
        <ManualAppSearch
          fetchWithAuth={fetchWithAuth}
          existingSlugs={new Set(data.competitors.map((c) => c.slug))}
          onAdd={addCompetitor}
        />
      )}

      {/* Keyword Suggestions */}
      {hasCompetitors && data.keywordSuggestions.length > 0 && (
        <SectionWrapper id="section-keyword-suggestions" title="More Keywords to Explore" icon={Lightbulb} subtitle="Based on your competitors' rankings & metadata">
          <KeywordSuggestions
            suggestions={data.keywordSuggestions}
            canEdit={canEdit}
            fetchWithAuth={fetchWithAuth}
            onAdd={addKeyword}
          />
        </SectionWrapper>
      )}

      {/* Market Language */}
      {hasRichData && data.wordAnalysis.length > 0 && (
        <SectionWrapper id="section-market-language" title="Market Language" icon={Type} subtitle="Common terms across your competitors">
          <MarketLanguage words={data.wordAnalysis} totalCompetitors={data.competitors.length} />
        </SectionWrapper>
      )}

      {/* Category Landscape */}
      {hasRichData && data.categories.length > 0 && (
        <SectionWrapper id="section-categories" title="Category Landscape" icon={LayoutGrid} subtitle="Categories where your competitors are listed">
          <CategoryLandscape categories={data.categories} competitors={data.competitors} keywordRankings={data.keywordRankings} />
        </SectionWrapper>
      )}

      {/* Feature Coverage */}
      {hasRichData && data.featureCoverage.length > 0 && (
        <SectionWrapper id="section-features" title="Feature Coverage" icon={Puzzle} subtitle="Which features competitors have">
          <FeatureCoverage features={data.featureCoverage} competitors={data.competitors} virtualApps={data.virtualApps || []} />
        </SectionWrapper>
      )}

      {/* Opportunities */}
      {hasKeywordScore && hasRichData && data.opportunities.length > 0 && (
        <SectionWrapper id="section-opportunities" title="Keyword Opportunities" icon={TrendingUp} subtitle="Best opportunities based on your research">
          <OpportunityTable opportunities={data.opportunities} />
        </SectionWrapper>
      )}
    </div>
  );
}
