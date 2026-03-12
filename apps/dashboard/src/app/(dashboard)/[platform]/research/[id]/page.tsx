"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  X,
  Plus,
  Star,
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
  Loader2,
  GitCompareArrows,
  Eye,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { ConfirmModal } from "@/components/confirm-modal";
import { LiveSearchTrigger } from "@/components/live-search-trigger";
import { buildExternalAppUrl, buildExternalSearchUrl, getPlatformName, formatCategoryTitle } from "@/lib/platform-urls";
import { PLATFORMS, isPlatformId, type PlatformId } from "@appranks/shared";

// ─── Types ───────────────────────────────────────────────────

interface ResearchData {
  project: { id: string; name: string; createdAt: string; updatedAt: string };
  keywords: { id: number; keyword: string; slug: string; totalResults: number | null; scrapedAt: string | null }[];
  competitors: {
    slug: string; name: string; iconUrl: string | null;
    averageRating: number | null; ratingCount: number | null;
    pricingHint: string | null; minPaidPrice: number | null;
    powerScore: number | null; categories: any[]; features: string[];
    categoryRankings: { slug: string; breadcrumb: string; position: number; totalApps: number | null }[];
    launchedAt: string | null;
    featuredSections: number;
    reverseSimilarCount: number;
  }[];
  keywordRankings: Record<string, Record<string, number>>;
  competitorSuggestions: {
    slug: string; name: string; iconUrl: string | null;
    averageRating: number | null; ratingCount: number | null;
    matchedKeywords: string[]; matchedCount: number; avgPosition: number;
  }[];
  keywordSuggestions: {
    keyword: string; slug?: string; competitorCount: number;
    bestPosition?: number; source: "ranking" | "metadata";
  }[];
  wordAnalysis: { word: string; totalScore: number; appCount: number; sources: Record<string, number> }[];
  categories: {
    slug: string; title: string; competitorCount: number; total: number;
    competitors: { slug: string; position: number }[];
  }[];
  featureCoverage: {
    feature: string; title: string; count: number; total: number;
    competitors: string[]; isGap: boolean;
    categoryType?: string; categoryTitle?: string; subcategoryTitle?: string;
  }[];
  opportunities: {
    keyword: string; slug: string; opportunityScore: number;
    room: number; demand: number; competitorCount: number; totalResults: number | null;
  }[];
  virtualApps: {
    id: string; researchProjectId: string; name: string;
    icon: string; color: string; iconUrl: string | null;
    appCardSubtitle: string; appIntroduction: string; appDetails: string;
    seoTitle: string; seoMetaDescription: string;
    features: string[]; integrations: string[]; languages: string[];
    categories: any[]; pricingPlans: any[];
    generatedByAi?: boolean;
    creatorName?: string | null;
    createdAt: string; updatedAt: string;
  }[];
}

// ─── Main Page ───────────────────────────────────────────────

export default function ResearchProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { fetchWithAuth, user } = useAuth();

  const id = params.id as string;
  const platform = params.platform as string;
  const canEdit = user?.role === "owner" || user?.role === "editor";

  const [data, setData] = useState<ResearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Polling
  const [pendingKeywords, setPendingKeywords] = useState<Set<number>>(new Set());
  const [pendingCompetitors, setPendingCompetitors] = useState<Set<string>>(new Set());
  const [resolvedKeywords, setResolvedKeywords] = useState<Set<number>>(new Set());
  const [resolvedCompetitors, setResolvedCompetitors] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

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
  useEffect(() => {
    const hasPending = pendingKeywords.size > 0 || pendingCompetitors.size > 0;
    if (hasPending) {
      pollRef.current = setInterval(fetchData, 5000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pendingKeywords.size, pendingCompetitors.size, fetchData]);

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

  const hasKeywords = (data?.keywords.length ?? 0) > 0;
  const hasCompetitors = (data?.competitors.length ?? 0) > 0;
  const hasRichData = (data?.keywords.length ?? 0) >= 3 && (data?.competitors.length ?? 0) >= 2;

  if (loading) {
    return (
      <div className="space-y-6">
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
        <Link href={`/${platform}/research`} className="text-muted-foreground hover:text-foreground">
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
              <Button size="sm" variant="ghost" onClick={saveName}><Check className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}><X className="h-4 w-4" /></Button>
            </div>
          ) : (
            <button
              onClick={() => { if (canEdit) { setNameValue(data.project.name); setEditingName(true); } }}
              className="flex items-center gap-2 group"
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

      {/* Layer 0/1: Keywords Section */}
      <KeywordsSection
        projectId={id}
        data={data}
        canEdit={canEdit}
        pendingKeywords={pendingKeywords}
        resolvedKeywords={resolvedKeywords}
        onAdd={async (keyword: string) => {
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
        }}
        onRemove={async (kwId: number) => {
          const res = await fetchWithAuth(`/api/research-projects/${id}/keywords/${kwId}`, {
            method: "DELETE",
          });
          if (res.ok) await fetchData();
        }}
      />

      {/* Competitor Table (right after keywords) */}
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
              onAdd={async (slug: string) => {
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
              }}
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
            onRemove={async (slug: string) => {
              const res = await fetchWithAuth(`/api/research-projects/${id}/competitors/${slug}`, {
                method: "DELETE",
              });
              if (res.ok) await fetchData();
            }}
          />
        </SectionWrapper>
      )}

      {/* Competitor Suggestions */}
      {hasKeywords && data.competitorSuggestions.length > 0 && (
        <SectionWrapper id="section-competitor-suggestions" title="Competitor Suggestions" icon={Users} subtitle="Apps that rank for your keywords">
          <CompetitorSuggestions
            suggestions={data.competitorSuggestions}
            canEdit={canEdit}
            onAdd={async (slug: string) => {
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
            }}
          />
        </SectionWrapper>
      )}

      {/* Manual app search (when no competitors yet) */}
      {!hasCompetitors && hasKeywords && canEdit && (
        <ManualAppSearch
          fetchWithAuth={fetchWithAuth}
          existingSlugs={new Set(data.competitors.map((c) => c.slug))}
          onAdd={async (slug: string) => {
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
          }}
        />
      )}

      {/* Layer 2: Keyword Suggestions */}
      {hasCompetitors && data.keywordSuggestions.length > 0 && (
        <SectionWrapper id="section-keyword-suggestions" title="More Keywords to Explore" icon={Lightbulb} subtitle="Based on your competitors' rankings & metadata">
          <KeywordSuggestions
            suggestions={data.keywordSuggestions}
            canEdit={canEdit}
            fetchWithAuth={fetchWithAuth}
            onAdd={async (keyword: string) => {
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
            }}
          />
        </SectionWrapper>
      )}

      {/* Layer 3: Market Language */}
      {hasRichData && data.wordAnalysis.length > 0 && (
        <SectionWrapper id="section-market-language" title="Market Language" icon={Type} subtitle="Common terms across your competitors">
          <MarketLanguage words={data.wordAnalysis} totalCompetitors={data.competitors.length} />
        </SectionWrapper>
      )}

      {/* Layer 3: Category Landscape */}
      {hasRichData && data.categories.length > 0 && (
        <SectionWrapper id="section-categories" title="Category Landscape" icon={LayoutGrid} subtitle="Categories where your competitors are listed">
          <CategoryLandscape categories={data.categories} competitors={data.competitors} keywordRankings={data.keywordRankings} />
        </SectionWrapper>
      )}

      {/* Layer 3: Feature Coverage */}
      {hasRichData && data.featureCoverage.length > 0 && (
        <SectionWrapper id="section-features" title="Feature Coverage" icon={Puzzle} subtitle="Which features competitors have">
          <FeatureCoverage features={data.featureCoverage} competitors={data.competitors} virtualApps={data.virtualApps || []} />
        </SectionWrapper>
      )}

      {/* Layer 3: Opportunities */}
      {hasRichData && data.opportunities.length > 0 && (
        <SectionWrapper id="section-opportunities" title="Keyword Opportunities" icon={TrendingUp} subtitle="Best opportunities based on your research">
          <OpportunityTable opportunities={data.opportunities} />
        </SectionWrapper>
      )}
    </div>
  );
}

// ─── Section Wrapper ─────────────────────────────────────────

function SectionWrapper({
  id, title, icon: Icon, subtitle, count, headerAction, titleHref, children,
}: {
  id?: string; title: string; icon: any; subtitle?: string; count?: number; headerAction?: React.ReactNode; titleHref?: string; children: React.ReactNode;
}) {
  return (
    <Card id={id} className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 scroll-mt-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4" />
            {titleHref ? (
              <Link href={titleHref} className="hover:underline">{title}</Link>
            ) : (
              title
            )}
            {count != null && <Badge variant="secondary" className="text-xs font-normal">{count}</Badge>}
          </CardTitle>
          {headerAction}
        </div>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ─── Summary Cards ──────────────────────────────────────────

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function SummaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <button
      onClick={() => scrollTo(href)}
      className="flex items-center justify-between w-full text-left hover:bg-accent/50 rounded-md px-2 py-1 -mx-2 transition-colors group"
    >
      {children}
    </button>
  );
}

function StatCard({ emoji, title, gradient, children }: {
  emoji: string; title: string; gradient: string; children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
      <div className={`h-1 ${gradient}`} />
      <CardContent className="pt-3 pb-3 px-4">
        <div className="flex flex-col items-center mb-2.5">
          <span className="text-2xl mb-0.5">{emoji}</span>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <div className="space-y-0.5 text-sm">{children}</div>
      </CardContent>
    </Card>
  );
}

function SummaryCards({ data }: { data: ResearchData }) {
  const { platform } = useParams();
  const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const hasCompetitors = data.competitors.length >= 2;
  const hasOpportunities = data.opportunities.length > 0;
  const hasKeywords = data.keywords.length > 0;
  const hasVirtualAppsEarly = (data.virtualApps?.length ?? 0) > 0;

  if (!hasCompetitors && !hasKeywords && !hasVirtualAppsEarly) return null;

  const comps = data.competitors;
  const ratings = comps.filter(c => c.averageRating != null);
  const avgRating = ratings.length > 0 ? ratings.reduce((s, c) => s + c.averageRating!, 0) / ratings.length : null;
  const avgReviews = ratings.length > 0 ? Math.round(ratings.reduce((s, c) => s + (c.ratingCount ?? 0), 0) / ratings.length) : null;
  const prices = comps.map(c => c.minPaidPrice).filter((p): p is number => p != null);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
  const powers = comps.map(c => c.powerScore).filter((p): p is number => p != null);
  const avgPower = powers.length > 0 ? Math.round(powers.reduce((a, b) => a + b, 0) / powers.length) : null;
  const strongest = powers.length > 0 ? comps.reduce((a, b) => (b.powerScore ?? 0) > (a.powerScore ?? 0) ? b : a) : null;
  const top3 = [...comps].filter(c => c.powerScore != null).sort((a, b) => (b.powerScore ?? 0) - (a.powerScore ?? 0)).slice(0, 3);
  const maxPower = top3.length > 0 ? (top3[0].powerScore ?? 1) : 1;
  const bestOpp = data.opportunities.length > 0 ? data.opportunities[0] : null;
  const highOppCount = data.opportunities.filter(o => o.opportunityScore >= 60).length;
  const gapCount = data.featureCoverage.filter(f => f.isGap).length;
  const hasDiscovery = hasKeywords && (data.competitorSuggestions.length > 0 || data.keywordSuggestions.length > 0 || data.wordAnalysis.length > 0);
  const hasPowers = hasCompetitors && powers.length > 0;
  const hasVirtualApps = (data.virtualApps?.length ?? 0) > 0;

  const cardCount = [hasCompetitors, hasPowers, hasOpportunities, hasDiscovery, hasVirtualApps].filter(Boolean).length;
  const gridClass = cardCount <= 2 ? "grid-cols-1 md:grid-cols-2" : cardCount <= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-5";

  return (
    <div className={`grid ${gridClass} gap-4`}>
      {/* Card 1: Market Overview */}
      {hasCompetitors && (
        <StatCard emoji="📊" title="Market Overview" gradient="bg-gradient-to-r from-blue-500 to-cyan-400">
          {caps.hasReviews && avgRating != null && (
            <SummaryLink href="section-competitors">
              <span className="text-muted-foreground flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{avgRating.toFixed(1)} avg rating
              </span>
              <span className="font-medium text-xs">{avgReviews?.toLocaleString()} reviews</span>
            </SummaryLink>
          )}
          <SummaryLink href="section-competitors">
            <span className="text-muted-foreground">
              {minPrice != null && maxPrice != null ? `$${minPrice} — $${maxPrice}/mo` : "No pricing data"}
            </span>
          </SummaryLink>
          {data.categories.length > 0 && (
            <SummaryLink href="section-categories">
              <span className="text-muted-foreground">{data.categories.length} categories</span>
              <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
            </SummaryLink>
          )}
        </StatCard>
      )}

      {/* Card 2: Competition */}
      {hasPowers && (
        <StatCard emoji="⚔️" title="Competition" gradient="bg-gradient-to-r from-orange-500 to-amber-400">
          <SummaryLink href="section-competitors">
            <span className="text-muted-foreground">{avgPower} avg power</span>
            <span className="font-medium text-xs">{strongest?.powerScore} strongest</span>
          </SummaryLink>
          {top3.map(c => (
            <SummaryLink key={c.slug} href="section-competitors">
              <span className="text-xs text-muted-foreground w-24 truncate">{c.name}</span>
              <div className="flex-1 mx-2 h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full" style={{ width: `${((c.powerScore ?? 0) / maxPower) * 100}%` }} />
              </div>
              <span className="text-xs font-medium w-6 text-right">{c.powerScore}</span>
            </SummaryLink>
          ))}
        </StatCard>
      )}

      {/* Card 3: Opportunities */}
      {hasOpportunities && (
        <StatCard emoji="🚀" title="Opportunities" gradient="bg-gradient-to-r from-emerald-500 to-green-400">
          {bestOpp && (
            <SummaryLink href="section-opportunities">
              <span className="text-muted-foreground truncate mr-2">Best: &quot;{bestOpp.keyword}&quot;</span>
              <Badge variant="secondary" className="text-xs shrink-0">{bestOpp.opportunityScore}</Badge>
            </SummaryLink>
          )}
          <SummaryLink href="section-opportunities">
            <span className="text-muted-foreground">{highOppCount} high opportunities</span>
            <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
          </SummaryLink>
          {gapCount > 0 && (
            <SummaryLink href="section-features">
              <span className="text-muted-foreground">{gapCount} feature gaps</span>
              <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
            </SummaryLink>
          )}
        </StatCard>
      )}

      {/* Card 4: Discovery */}
      {hasDiscovery && (
        <StatCard emoji="💡" title="Discovery" gradient="bg-gradient-to-r from-violet-500 to-purple-400">
          {data.competitorSuggestions.length > 0 && (
            <SummaryLink href="section-competitor-suggestions">
              <span className="text-muted-foreground">{data.competitorSuggestions.length} app suggestions</span>
              <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
            </SummaryLink>
          )}
          {data.keywordSuggestions.length > 0 && (
            <SummaryLink href="section-keyword-suggestions">
              <span className="text-muted-foreground">{data.keywordSuggestions.length} keyword ideas</span>
              <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
            </SummaryLink>
          )}
          {data.wordAnalysis.length > 0 && (
            <SummaryLink href="section-market-language">
              <span className="text-muted-foreground">{data.wordAnalysis.length} market terms</span>
              <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
            </SummaryLink>
          )}
        </StatCard>
      )}

      {/* Card 5: Virtual Apps */}
      {hasVirtualApps && (
        <StatCard emoji="✨" title="Virtual Apps" gradient="bg-gradient-to-r from-pink-500 to-rose-400">
          {(data.virtualApps || []).map((va) => {
            const featCount = (va.features?.length || 0) + (va.categories || []).reduce(
              (acc: number, cat: any) => acc + (cat.subcategories || []).reduce(
                (a2: number, sub: any) => a2 + (sub.features?.length || 0), 0
              ), 0
            );
            return (
              <SummaryLink key={va.id} href="section-virtual-apps">
                <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                  <span
                    className="h-4 w-4 rounded flex items-center justify-center shrink-0 text-[10px]"
                    style={{ backgroundColor: `${va.color || "#3B82F6"}20` }}
                  >
                    {va.icon || "🚀"}
                  </span>
                  <span className="truncate">{va.name}</span>
                </span>
                <span className="font-medium text-xs shrink-0">{featCount}f / {va.integrations?.length || 0}i</span>
              </SummaryLink>
            );
          })}
        </StatCard>
      )}
    </div>
  );
}

// ─── Keywords Section ────────────────────────────────────────

function KeywordsSection({
  projectId, data, canEdit, pendingKeywords, resolvedKeywords, onAdd, onRemove,
}: {
  projectId: string; data: ResearchData; canEdit: boolean; pendingKeywords: Set<number>; resolvedKeywords: Set<number>;
  onAdd: (keyword: string) => Promise<void>; onRemove: (kwId: number) => Promise<void>;
}) {
  const { platform } = useParams();
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleAdd() {
    if (!input.trim() || adding) return;
    setAdding(true);
    try {
      await onAdd(input.trim());
      setInput("");
    } finally {
      setAdding(false);
    }
  }

  const isEmpty = data.keywords.length === 0;

  return (
    <Card id="section-keywords" className="scroll-mt-6">
      {isEmpty ? (
        <CardContent className="py-12">
          <div className="flex flex-col items-center text-center">
            <Search className="h-10 w-10 text-muted-foreground mb-3" />
            <h2 className="text-lg font-semibold mb-1">What market are you exploring?</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Start with keywords your potential customers would search for in the Shopify App Store.
            </p>
            {canEdit && (
              <div className="flex gap-2 w-full max-w-md">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                  placeholder='e.g. "live chat", "email marketing"'
                  disabled={adding}
                />
                <Button onClick={handleAdd} disabled={!input.trim() || adding}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      ) : (
        <>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4" />
                <Link href={`/${platform}/research/${projectId}/keywords`} className="hover:underline">Keywords</Link>
                <Badge variant="secondary" className="text-xs font-normal">{data.keywords.length}</Badge>
              </CardTitle>
              {canEdit && (
                <div ref={containerRef}>
                  {!open ? (
                    <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="h-8">
                      <Search className="h-3.5 w-3.5 mr-1.5" />
                      Add keyword
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAdd();
                          if (e.key === "Escape") { setOpen(false); setInput(""); }
                        }}
                        placeholder="Type keyword and press Enter..."
                        className="h-8 w-56 text-sm"
                        disabled={adding}
                        autoFocus
                      />
                      {adding && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-center" />}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.keywords.map((kw) => {
                const isPending = pendingKeywords.has(kw.id);
                const isResolved = resolvedKeywords.has(kw.id);
                return (
                  <Badge
                    key={kw.id}
                    variant="secondary"
                    className={`text-sm px-3 py-1 ${isPending ? "animate-in fade-in slide-in-from-top duration-300" : ""}`}
                  >
                    <Link href={`/${platform}/keywords/${kw.slug}`} className="hover:underline">
                      {kw.keyword}
                    </Link>
                    {isPending ? (
                      <Loader2 className="ml-1.5 h-3 w-3 animate-spin text-muted-foreground" />
                    ) : kw.totalResults != null ? (
                      <span className={`ml-1.5 text-xs text-muted-foreground ${isResolved ? "animate-in fade-in duration-700" : ""}`}>
                        ({kw.totalResults})
                      </span>
                    ) : null}
                    {canEdit && (
                      <button
                        onClick={() => onRemove(kw.id)}
                        className="ml-1.5 hover:text-destructive transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}

// ─── Competitor Suggestions ──────────────────────────────────

function CompetitorSuggestions({
  suggestions, canEdit, onAdd,
}: {
  suggestions: ResearchData["competitorSuggestions"]; canEdit: boolean;
  onAdd: (slug: string) => Promise<void>;
}) {
  const { platform } = useParams();
  const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const [addingSlug, setAddingSlug] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const INITIAL_COUNT = 10;

  async function handleAdd(slug: string) {
    setAddingSlug(slug);
    try {
      await onAdd(slug);
    } finally {
      setAddingSlug(null);
    }
  }

  const visible = expanded ? suggestions : suggestions.slice(0, INITIAL_COUNT);
  const hasMore = suggestions.length > INITIAL_COUNT;

  return (
    <div className="space-y-2">
      {visible.map((s) => (
        <div key={s.slug} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50">
          <div className="flex items-center gap-3 min-w-0">
            {s.iconUrl ? (
              <img src={s.iconUrl} alt="" className="h-8 w-8 rounded-md" />
            ) : (
              <div className="h-8 w-8 rounded-md bg-muted" />
            )}
            <div className="min-w-0">
              <Link href={`/${platform}/apps/${s.slug}`} className="font-medium text-sm truncate hover:underline block">{s.name}</Link>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {caps.hasReviews && s.averageRating != null && (
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    {s.averageRating.toFixed(1)}
                  </span>
                )}
                {caps.hasReviews && s.ratingCount != null && <span>({s.ratingCount.toLocaleString()})</span>}
                <span className="text-muted-foreground/60">|</span>
                <span>Matches: {s.matchedKeywords.join(", ")}</span>
              </div>
            </div>
          </div>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAdd(s.slug)}
              disabled={addingSlug === s.slug}
              className="shrink-0 ml-2"
            >
              {addingSlug === s.slug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              <span className="ml-1">Add</span>
            </Button>
          )}
        </div>
      ))}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : `Show ${suggestions.length - INITIAL_COUNT} more`}
        </Button>
      )}
    </div>
  );
}

// ─── Inline App Search (header) ──────────────────────────────

function InlineAppSearch({
  fetchWithAuth, existingSlugs, onAdd,
}: {
  fetchWithAuth: (path: string, options?: any) => Promise<Response>;
  existingSlugs: Set<string>; onAdd: (slug: string) => Promise<void>;
}) {
  const { platform } = useParams();
  const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingSlug, setAddingSlug] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleSearch(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) { setResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const res = await fetchWithAuth(`/api/apps/search?q=${encodeURIComponent(value)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(
          data
            .filter((a: any) => !existingSlugs.has(a.slug))
            .sort((a: any, b: any) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0))
        );
      }
      setSearching(false);
    }, 300);
  }

  async function handleAdd(slug: string) {
    setAddingSlug(slug);
    try {
      await onAdd(slug);
      setResults((prev) => prev.filter((r) => r.slug !== slug));
    } finally {
      setAddingSlug(null);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="h-8">
        <Search className="h-3.5 w-3.5 mr-1.5" />
        Add app
      </Button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search apps..."
        className="h-8 w-56 text-sm"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); setQuery(""); setResults([]); } }}
      />
      {(results.length > 0 || searching) && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-popover border rounded-md shadow-lg z-50 max-h-72 overflow-y-auto">
          {results.slice(0, 8).map((app) => (
            <div key={app.slug} className="flex items-center justify-between py-1.5 px-3 hover:bg-muted/50">
              <div className="flex items-center gap-2 min-w-0">
                {app.iconUrl ? (
                  <img src={app.iconUrl} alt="" className="h-6 w-6 rounded" />
                ) : (
                  <div className="h-6 w-6 rounded bg-muted" />
                )}
                <span className="text-sm truncate">{app.name}</span>
                {caps.hasReviews && app.averageRating != null && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    <Star className="h-3 w-3 inline fill-yellow-500 text-yellow-500" /> {parseFloat(app.averageRating).toFixed(1)}
                    {app.ratingCount != null && <span className="ml-1">({Number(app.ratingCount).toLocaleString()})</span>}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleAdd(app.slug)}
                disabled={addingSlug === app.slug}
                className="shrink-0 ml-1"
              >
                {addingSlug === app.slug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
          {searching && <p className="text-xs text-muted-foreground px-3 py-2">Searching...</p>}
        </div>
      )}
    </div>
  );
}

// ─── Manual App Search ───────────────────────────────────────

function ManualAppSearch({
  fetchWithAuth, existingSlugs, onAdd,
}: {
  fetchWithAuth: (path: string, options?: any) => Promise<Response>;
  existingSlugs: Set<string>; onAdd: (slug: string) => Promise<void>;
}) {
  const { platform } = useParams();
  const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingSlug, setAddingSlug] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleSearch(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) { setResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const res = await fetchWithAuth(`/api/apps/search?q=${encodeURIComponent(value)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(
          data
            .filter((a: any) => !existingSlugs.has(a.slug))
            .sort((a: any, b: any) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0))
        );
      }
      setSearching(false);
    }, 300);
  }

  async function handleAdd(slug: string) {
    setAddingSlug(slug);
    try {
      await onAdd(slug);
      setResults((prev) => prev.filter((r) => r.slug !== slug));
    } finally {
      setAddingSlug(null);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Search & add manually</span>
        </div>
        <div ref={containerRef}>
          <Input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search apps..."
            className="h-9"
          />
          {results.length > 0 && (
            <div className="mt-2 space-y-1">
              {results.slice(0, 8).map((app) => (
                <div key={app.slug} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2 min-w-0">
                    {app.iconUrl ? (
                      <img src={app.iconUrl} alt="" className="h-6 w-6 rounded" />
                    ) : (
                      <div className="h-6 w-6 rounded bg-muted" />
                    )}
                    <span className="text-sm truncate">{app.name}</span>
                    {caps.hasReviews && app.averageRating != null && (
                      <span className="text-xs text-muted-foreground">
                        <Star className="h-3 w-3 inline fill-yellow-500 text-yellow-500" /> {parseFloat(app.averageRating).toFixed(1)}
                        {app.ratingCount != null && <span className="ml-1">({Number(app.ratingCount).toLocaleString()})</span>}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAdd(app.slug)}
                    disabled={addingSlug === app.slug}
                  >
                    {addingSlug === app.slug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
          {searching && <p className="text-xs text-muted-foreground mt-2">Searching...</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Competitor Table ────────────────────────────────────────

function CompetitorTable({
  competitors, keywordRankings, keywords, pendingCompetitors, resolvedCompetitors, canEdit, onRemove,
}: {
  competitors: ResearchData["competitors"];
  keywordRankings: ResearchData["keywordRankings"];
  keywords: ResearchData["keywords"];
  pendingCompetitors: Set<string>; resolvedCompetitors: Set<string>; canEdit: boolean;
  onRemove: (slug: string) => Promise<void>;
}) {
  const { platform } = useParams();
  const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  type CompSortKey = "name" | "rating" | "reviews" | "pricing" | "power" | "rankings" | "featured" | "similar" | "launched";
  const [sortKey, setSortKey] = useState<CompSortKey>(caps.hasReviews ? "reviews" : "name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(caps.hasReviews ? "desc" : "asc");

  function toggleSort(key: CompSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function SortIcon({ col }: { col: CompSortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="inline h-3 w-3 ml-0.5 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="inline h-3 w-3 ml-0.5" /> : <ArrowDown className="inline h-3 w-3 ml-0.5" />;
  }

  const rankCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const comp of competitors) {
      let count = 0;
      for (const kwSlug of Object.keys(keywordRankings)) {
        if (keywordRankings[kwSlug]?.[comp.slug] != null) count++;
      }
      map.set(comp.slug, count);
    }
    return map;
  }, [competitors, keywordRankings]);

  const sorted = useMemo(() => {
    return [...competitors].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "rating": cmp = (a.averageRating ?? -1) - (b.averageRating ?? -1); break;
        case "reviews": cmp = (a.ratingCount ?? -1) - (b.ratingCount ?? -1); break;
        case "pricing": cmp = (a.minPaidPrice ?? -1) - (b.minPaidPrice ?? -1); break;
        case "power": cmp = (a.powerScore ?? -1) - (b.powerScore ?? -1); break;
        case "rankings": cmp = (rankCountMap.get(a.slug) ?? 0) - (rankCountMap.get(b.slug) ?? 0); break;
        case "featured": cmp = (a.featuredSections ?? 0) - (b.featuredSections ?? 0); break;
        case "similar": cmp = (a.reverseSimilarCount ?? 0) - (b.reverseSimilarCount ?? 0); break;
        case "launched": cmp = (a.launchedAt ?? "").localeCompare(b.launchedAt ?? ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [competitors, sortKey, sortDir, rankCountMap]);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>App <SortIcon col="name" /></TableHead>
            {caps.hasReviews && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("rating")}>Rating <SortIcon col="rating" /></TableHead>}
            {caps.hasReviews && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("reviews")}>Reviews <SortIcon col="reviews" /></TableHead>}
            {caps.hasPricing && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("pricing")}>Pricing <SortIcon col="pricing" /></TableHead>}
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("power")}>Power <SortIcon col="power" /></TableHead>
            {keywords.length > 0 && <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("rankings")}>Rankings <SortIcon col="rankings" /></TableHead>}
            {caps.hasFeaturedSections && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("featured")}>Featured <SortIcon col="featured" /></TableHead>}
            {caps.hasSimilarApps && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("similar")}>Similar <SortIcon col="similar" /></TableHead>}
            <TableHead>Categories</TableHead>
            {caps.hasLaunchedDate && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("launched")}>Launched <SortIcon col="launched" /></TableHead>}
            {canEdit && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((comp) => {
            const isPending = pendingCompetitors.has(comp.slug);
            const isResolved = resolvedCompetitors.has(comp.slug);
            const animate = isResolved ? "animate-in fade-in duration-700" : "";
            const rankCount = rankCountMap.get(comp.slug) ?? 0;

            return (
              <TableRow key={comp.slug} className={isPending ? "animate-in fade-in slide-in-from-top duration-300" : ""}>
                <TableCell className="max-w-[260px]">
                  <div className="flex items-center gap-2">
                    {comp.iconUrl ? (
                      <img src={comp.iconUrl} alt="" className="h-7 w-7 rounded shrink-0" />
                    ) : (
                      <div className="h-7 w-7 rounded bg-muted shrink-0" />
                    )}
                    <Link href={`/${platform}/apps/${comp.slug}`} className="font-medium text-sm hover:underline truncate">
                      {comp.name}
                    </Link>
                    {isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
                  </div>
                </TableCell>
                {caps.hasReviews && (
                  <TableCell className="text-right">
                    {isPending ? (
                      <Skeleton className="h-4 w-10 ml-auto" />
                    ) : comp.averageRating != null ? (
                      <span className={`flex items-center justify-end gap-1 ${animate}`}>
                        <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                        {comp.averageRating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{"\u2014"}</span>
                    )}
                  </TableCell>
                )}
                {caps.hasReviews && (
                  <TableCell className="text-right">
                    {isPending ? (
                      <Skeleton className="h-4 w-12 ml-auto" />
                    ) : (
                      <span className={animate}>{comp.ratingCount?.toLocaleString() ?? "\u2014"}</span>
                    )}
                  </TableCell>
                )}
                {caps.hasPricing && (
                  <TableCell className="text-right text-sm">
                    {isPending ? (
                      <Skeleton className="h-4 w-14 ml-auto" />
                    ) : (
                      <span className={animate}>
                        {comp.minPaidPrice != null
                          ? `$${comp.minPaidPrice}/mo`
                          : comp.pricingHint || "\u2014"}
                      </span>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  {isPending ? (
                    <Skeleton className="h-5 w-8 ml-auto rounded-full" />
                  ) : comp.powerScore != null ? (
                    <span className={animate}>
                      <Badge variant={comp.powerScore >= 70 ? "default" : "secondary"}>
                        {comp.powerScore}
                      </Badge>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                  )}
                </TableCell>
                {keywords.length > 0 && (
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {isPending ? (
                      <Skeleton className="h-4 w-12 mx-auto" />
                    ) : (
                      <span className={animate}>{rankCount > 0 ? `${rankCount}/${keywords.length} kw` : "\u2014"}</span>
                    )}
                  </TableCell>
                )}
                {caps.hasFeaturedSections && (
                  <TableCell className="text-right text-sm">
                    {isPending ? (
                      <Skeleton className="h-4 w-6 ml-auto" />
                    ) : comp.featuredSections > 0 ? (
                      <Link href={`/${platform}/apps/${comp.slug}/featured`} className={`text-primary hover:underline ${animate}`}>{comp.featuredSections}</Link>
                    ) : (
                      <span className="text-muted-foreground">{"\u2014"}</span>
                    )}
                  </TableCell>
                )}
                {caps.hasSimilarApps && (
                  <TableCell className="text-right text-sm">
                    {isPending ? (
                      <Skeleton className="h-4 w-6 ml-auto" />
                    ) : comp.reverseSimilarCount > 0 ? (
                      <Link href={`/${platform}/apps/${comp.slug}/similar`} className={`text-primary hover:underline ${animate}`}>{comp.reverseSimilarCount}</Link>
                    ) : (
                      <span className="text-muted-foreground">{"\u2014"}</span>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  {isPending ? (
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  ) : comp.categoryRankings?.length > 0 ? (
                    <div className={`space-y-1 ${animate}`}>
                      {comp.categoryRankings.slice(0, 3).map((cr) => {
                        const leafName = cr.breadcrumb.includes(" > ") ? cr.breadcrumb.split(" > ").pop() : cr.breadcrumb;
                        return (
                          <Link
                            key={cr.slug}
                            href={`/${platform}/categories/${cr.slug}`}
                            className="block text-[11px] leading-tight hover:underline"
                            title={cr.breadcrumb}
                          >
                            <span className="text-muted-foreground">{leafName}</span>
                            {cr.totalApps != null ? (
                              <span className="ml-1 font-medium text-primary">(#{cr.position}/{cr.totalApps})</span>
                            ) : (
                              <span className="ml-1 font-medium text-primary">(#{cr.position})</span>
                            )}
                          </Link>
                        );
                      })}
                      {comp.categoryRankings.length > 3 && (
                        <span className="text-[11px] text-muted-foreground">
                          +{comp.categoryRankings.length - 3} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                  )}
                </TableCell>
                {caps.hasLaunchedDate && (
                  <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                    {isPending ? (
                      <Skeleton className="h-4 w-16 ml-auto" />
                    ) : (
                      <span className={animate}>
                        {comp.launchedAt
                          ? new Date(comp.launchedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                          : "\u2014"}
                      </span>
                    )}
                  </TableCell>
                )}
                {canEdit && (
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <a
                        href={buildExternalAppUrl(platform as PlatformId, comp.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title={`View on ${getPlatformName(platform as PlatformId)}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        onClick={() => onRemove(comp.slug)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Keyword Suggestions ─────────────────────────────────────

function KeywordSuggestions({
  suggestions, canEdit, fetchWithAuth, onAdd,
}: {
  suggestions: ResearchData["keywordSuggestions"]; canEdit: boolean;
  fetchWithAuth: (path: string, options?: any) => Promise<Response>;
  onAdd: (keyword: string) => Promise<void>;
}) {
  const { platform } = useParams();
  const router = useRouter();
  const [addingKw, setAddingKw] = useState<string | null>(null);
  const [ensuringKw, setEnsuringKw] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const INITIAL_COUNT = 15;

  async function handleAdd(keyword: string) {
    setAddingKw(keyword);
    try {
      await onAdd(keyword);
    } finally {
      setAddingKw(null);
    }
  }

  function toSlug(word: string) {
    return word.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }

  async function handleKeywordClick(e: React.MouseEvent, s: ResearchData["keywordSuggestions"][0]) {
    if (s.slug) return; // tracked keyword — let the Link handle it
    e.preventDefault();
    setEnsuringKw(s.keyword);
    try {
      const res = await fetchWithAuth("/api/keywords/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: s.keyword }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/${platform}/keywords/${data.slug}`);
      }
    } finally {
      setEnsuringKw(null);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return suggestions;
    const q = search.toLowerCase();
    return suggestions.filter((s) => s.keyword.toLowerCase().includes(q));
  }, [suggestions, search]);

  const visible = search ? filtered : (expanded ? filtered : filtered.slice(0, INITIAL_COUNT));
  const hasMore = !search && filtered.length > INITIAL_COUNT;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter suggestions..."
          className="h-8 w-56 text-sm"
        />
        {search && (
          <span className="text-xs text-muted-foreground">{filtered.length} results</span>
        )}
      </div>
      <div className="space-y-1">
        {visible.map((s) => (
          <div key={s.keyword} className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <Link
                href={`/${platform}/keywords/${s.slug || toSlug(s.keyword)}`}
                className="text-sm font-medium hover:underline"
                onClick={(e) => handleKeywordClick(e, s)}
              >
                {ensuringKw === s.keyword ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    &ldquo;{s.keyword}&rdquo;
                  </span>
                ) : (
                  <>&ldquo;{s.keyword}&rdquo;</>
                )}
              </Link>
              <span className="text-xs text-muted-foreground">
                {s.competitorCount} competitor{s.competitorCount !== 1 ? "s" : ""} rank
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {s.source}
              </Badge>
            </div>
            <div className="flex items-center gap-0.5">
              <LiveSearchTrigger keyword={s.keyword} variant="icon" />
              <a
                href={buildExternalSearchUrl(platform as PlatformId, s.keyword)}
                target="_blank"
                rel="noopener noreferrer"
                title={`Search "${s.keyword}" on ${getPlatformName(platform as PlatformId)}`}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAdd(s.keyword)}
                  disabled={addingKw === s.keyword}
                >
                  {addingKw === s.keyword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          </div>
        ))}
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Show less" : `Show ${filtered.length - INITIAL_COUNT} more`}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Market Language (Word Cloud + Table) ────────────────────

function MarketLanguage({
  words, totalCompetitors,
}: {
  words: ResearchData["wordAnalysis"]; totalCompetitors: number;
}) {
  const { platform } = useParams();
  const [search, setSearch] = useState("");
  const maxScore = useMemo(() => Math.max(...words.map((w) => w.totalScore), 1), [words]);

  const filtered = useMemo(() => {
    if (!search.trim()) return words;
    const q = search.toLowerCase();
    return words.filter((w) => w.word.toLowerCase().includes(q));
  }, [words, search]);

  const fieldLabels: Record<string, { label: string; color: string }> = {
    name: { label: "Name", color: "bg-blue-500/20 text-blue-700" },
    subtitle: { label: "Subtitle", color: "bg-purple-500/20 text-purple-700" },
    introduction: { label: "Intro", color: "bg-green-500/20 text-green-700" },
    description: { label: "Desc", color: "bg-orange-500/20 text-orange-700" },
    categories: { label: "Cat", color: "bg-pink-500/20 text-pink-700" },
    features: { label: "Feat", color: "bg-cyan-500/20 text-cyan-700" },
    categoryFeatures: { label: "CatFeat", color: "bg-amber-500/20 text-amber-700" },
  };

  function toSlug(word: string) {
    return word.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }

  return (
    <div className="space-y-4">
      {/* Tag Cloud */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 p-4 bg-muted/30 rounded-lg">
        {words.slice(0, 30).map((w) => {
          const sizeRatio = w.totalScore / maxScore;
          const fontSize = 0.75 + sizeRatio * 1;
          const opacity = 0.4 + (w.appCount / totalCompetitors) * 0.6;
          return (
            <Link
              key={w.word}
              href={`/${platform}/keywords/${toSlug(w.word)}`}
              className="inline-block leading-tight font-medium hover:underline"
              style={{ fontSize: `${fontSize}rem`, opacity }}
            >
              {w.word}
            </Link>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter terms..."
          className="h-8 w-56 text-sm"
        />
        {search && (
          <span className="text-xs text-muted-foreground">{filtered.length} results</span>
        )}
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Term</TableHead>
            <TableHead className="text-right">Apps</TableHead>
            <TableHead>Fields</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(search ? filtered : filtered.slice(0, 20)).map((w) => (
            <TableRow key={w.word}>
              <TableCell className="font-medium text-sm">
                <Link
                  href={`/${platform}/keywords/${toSlug(w.word)}`}
                  className="hover:underline"
                >
                  {w.word}
                </Link>
              </TableCell>
              <TableCell className="text-right text-sm">
                {w.appCount}/{totalCompetitors}
              </TableCell>
              <TableCell>
                <div className="flex gap-1 flex-wrap">
                  {Object.entries(w.sources)
                    .sort(([, a], [, b]) => b - a)
                    .map(([field, count]) => {
                      const info = fieldLabels[field] || { label: field, color: "bg-gray-500/20 text-gray-700" };
                      return (
                        <span key={field} className={`text-[10px] px-1.5 py-0.5 rounded ${info.color}`}>
                          {info.label} ({count})
                        </span>
                      );
                    })}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-0.5">
                  <LiveSearchTrigger keyword={w.word} variant="icon" />
                  <a
                    href={buildExternalSearchUrl(platform as PlatformId, w.word)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Search "${w.word}" on ${getPlatformName(platform as PlatformId)}`}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </a>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Category Landscape ──────────────────────────────────────

function CategoryLandscape({
  categories, competitors, keywordRankings,
}: {
  categories: ResearchData["categories"]; competitors: ResearchData["competitors"]; keywordRankings: ResearchData["keywordRankings"];
}) {
  const { platform } = useParams();
  const compMap = useMemo(
    () => new Map(competitors.map((c) => [c.slug, c])),
    [competitors]
  );

  const rankedKeywordCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const appMap of Object.values(keywordRankings)) {
      for (const slug of Object.keys(appMap)) {
        counts.set(slug, (counts.get(slug) || 0) + 1);
      }
    }
    return counts;
  }, [keywordRankings]);

  return (
    <div className="space-y-5">
      {categories.map((cat) => (
        <div key={cat.slug}>
          <div className="flex items-center justify-between mb-2">
            <Link href={`/${platform}/categories/${cat.slug}`} className="font-medium text-sm hover:underline">
              {formatCategoryTitle(platform as PlatformId, cat.slug, cat.title)}
            </Link>
            <span className="text-xs text-muted-foreground">
              {cat.competitorCount}/{cat.total} apps
            </span>
          </div>
          <div className="space-y-1.5 pl-3 border-l-2 border-muted">
            {[...cat.competitors].sort((a, b) => a.position - b.position).map((c) => {
              const comp = compMap.get(c.slug);
              if (!comp) return null;
              return (
                <div key={c.slug} className="flex items-center gap-3 py-1">
                  <span className="text-xs font-mono text-muted-foreground w-8 text-right shrink-0">#{c.position}</span>
                  <Link href={`/${platform}/apps/${c.slug}`} className="flex items-center gap-2 min-w-0 flex-1 group">
                    {comp.iconUrl ? (
                      <img src={comp.iconUrl} alt={comp.name} className="h-6 w-6 rounded shrink-0" />
                    ) : (
                      <div className="h-6 w-6 rounded bg-muted shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate group-hover:underline">{comp.name}</span>
                  </Link>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                    {comp.averageRating != null && (
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {comp.averageRating.toFixed(1)}
                      </span>
                    )}
                    {comp.ratingCount != null && (
                      <span className="w-14 text-right">{comp.ratingCount.toLocaleString()} rev</span>
                    )}
                    {(rankedKeywordCounts.get(c.slug) ?? 0) > 0 && (
                      <span className="w-12 text-right">{rankedKeywordCounts.get(c.slug)} kw</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Feature Coverage ────────────────────────────────────────

function FeatureCoverage({
  features, competitors, virtualApps,
}: {
  features: ResearchData["featureCoverage"];
  competitors: ResearchData["competitors"];
  virtualApps?: ResearchData["virtualApps"];
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

// ─── Virtual Apps ────────────────────────────────────────────

const AI_GENERATION_STEPS = [
  { icon: "🔍", label: "Analyzing competitor data", detail: "Scanning features, pricing, and market positioning..." },
  { icon: "📊", label: "Building market summary", detail: "Compressing research into actionable insights..." },
  { icon: "🧠", label: "AI is strategizing", detail: "Identifying niches, gaps, and opportunities..." },
  { icon: "✨", label: "Generating app concepts", detail: "Crafting differentiated positioning for each app..." },
  { icon: "🎯", label: "Selecting features & integrations", detail: "Matching capabilities to each app's strategy..." },
  { icon: "💰", label: "Designing pricing plans", detail: "Building competitive pricing tiers..." },
  { icon: "🔎", label: "Optimizing SEO & metadata", detail: "Writing titles, descriptions, and keywords..." },
  { icon: "✅", label: "Validating & saving", detail: "Cross-checking against real market data..." },
];

const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  width: 8 + (((i * 7 + 3) % 11) / 10) * 16,
  height: 8 + (((i * 13 + 5) % 11) / 10) * 16,
  left: ((i * 17 + 7) % 100),
  top: ((i * 23 + 11) % 100),
  duration: 2 + (((i * 9 + 1) % 11) / 10) * 2,
}));

function AiGenerationOverlay({ currentStep, error, onClose }: {
  currentStep: number; error: string | null; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-300">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border">
        {/* Header gradient */}
        <div className="relative bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-700 px-6 pt-6 pb-8 text-white">
          <div className="absolute inset-0 overflow-hidden">
            {PARTICLES.map((p, i) => (
              <div
                key={i}
                className="absolute rounded-full opacity-10 animate-pulse"
                style={{
                  width: `${p.width}px`,
                  height: `${p.height}px`,
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  backgroundColor: "white",
                  animationDelay: `${i * 0.3}s`,
                  animationDuration: `${p.duration}s`,
                }}
              />
            ))}
          </div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg">AI App Generator</h3>
                <p className="text-sm text-white/70">Creating your app concepts</p>
              </div>
            </div>
            {/* Progress bar */}
            {!error && (
              <div className="mt-4 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${Math.min(((currentStep + 1) / AI_GENERATION_STEPS.length) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 max-h-[340px] overflow-y-auto">
          {error ? (
            <div className="text-center py-4">
              <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center mx-auto mb-3">
                <X className="h-6 w-6 text-red-500" />
              </div>
              <p className="font-medium text-sm mb-1">Generation failed</p>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
            </div>
          ) : (
            <div className="space-y-1">
              {AI_GENERATION_STEPS.map((step, i) => {
                const isActive = i === currentStep;
                const isDone = i < currentStep;
                const isPending = i > currentStep;

                return (
                  <div
                    key={i}
                    className={`flex items-start gap-3 py-2 px-2 rounded-lg transition-all duration-500 ${
                      isActive ? "bg-purple-50 dark:bg-purple-950/30" : ""
                    } ${isPending ? "opacity-30" : ""}`}
                  >
                    {/* Step indicator */}
                    <div className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-sm transition-all duration-500 ${
                      isDone ? "bg-green-100 dark:bg-green-950" :
                      isActive ? "bg-purple-100 dark:bg-purple-900 shadow-sm shadow-purple-200 dark:shadow-purple-900" :
                      "bg-muted"
                    }`}>
                      {isDone ? (
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : isActive ? (
                        <span className="animate-bounce">{step.icon}</span>
                      ) : (
                        <span>{step.icon}</span>
                      )}
                    </div>
                    {/* Label */}
                    <div className="min-w-0 pt-0.5">
                      <p className={`text-sm font-medium leading-tight ${isDone ? "text-green-700 dark:text-green-400" : isActive ? "text-purple-700 dark:text-purple-300" : ""}`}>
                        {step.label}
                      </p>
                      {isActive && (
                        <p className="text-xs text-muted-foreground mt-0.5 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
                          {step.detail}
                        </p>
                      )}
                    </div>
                    {/* Spinner for active */}
                    {isActive && (
                      <Loader2 className="h-4 w-4 text-purple-500 animate-spin shrink-0 mt-1 ml-auto" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GenerateVirtualAppsButton({
  projectId, competitorCount, onGenerated,
}: {
  projectId: string; competitorCount: number; onGenerated: () => void;
}) {
  const { fetchWithAuth } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    return () => { clearInterval(stepIntervalRef.current); };
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setCurrentStep(0);
    setError(null);

    // Animate steps: advance every ~3s, pause at last step until response arrives
    let step = 0;
    stepIntervalRef.current = setInterval(() => {
      step++;
      if (step < AI_GENERATION_STEPS.length - 1) {
        setCurrentStep(step);
      } else {
        setCurrentStep(AI_GENERATION_STEPS.length - 1);
        clearInterval(stepIntervalRef.current);
      }
    }, 3000);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);
      const res = await fetchWithAuth(`/api/research-projects/${projectId}/virtual-apps/generate`, {
        method: "POST",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      clearInterval(stepIntervalRef.current);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Generation failed");
        return;
      }

      // Show completion briefly
      setCurrentStep(AI_GENERATION_STEPS.length);
      await new Promise((r) => setTimeout(r, 800));
      setGenerating(false);
      onGenerated();
    } catch (err: any) {
      clearInterval(stepIntervalRef.current);
      setError(err.name === "AbortError" ? "Request timed out — please try again" : "Generation failed");
    }
  }

  function handleClose() {
    setGenerating(false);
    setError(null);
    clearInterval(stepIntervalRef.current);
  }

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={generating || competitorCount < 2}
        className="group relative inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold text-white overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 active:scale-95 ai-btn-bg"
      >
        <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ai-btn-shimmer" />
        <Sparkles className="h-3.5 w-3.5 relative" />
        <span className="relative">Generate with AI</span>
      </button>

      {generating && (
        <AiGenerationOverlay currentStep={currentStep} error={error} onClose={handleClose} />
      )}
    </>
  );
}

function CreateVirtualAppButton({ projectId }: { projectId: string }) {
  const { platform } = useParams();
  const router = useRouter();

  return (
    <Button size="sm" variant="outline" onClick={() => router.push(`/${platform}/research/${projectId}/virtual-apps/new`)}>
      <Plus className="h-3.5 w-3.5 mr-1.5" />
      New App
    </Button>
  );
}

function VirtualAppsGrid({
  virtualApps, projectId, canEdit, fetchWithAuth, onDelete,
}: {
  virtualApps: ResearchData["virtualApps"]; projectId: string; canEdit: boolean;
  fetchWithAuth: any; onDelete: () => void;
}) {
  const { platform } = useParams();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    setDeleteTarget(null);
    try {
      const res = await fetchWithAuth(`/api/research-projects/${projectId}/virtual-apps/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) onDelete();
    } finally {
      setDeletingId(null);
    }
  }

  if (virtualApps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No virtual apps yet. Create one to start designing your app.
      </p>
    );
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {virtualApps.map((va) => {
          const featureCount = (va.features?.length || 0) + (va.categories || []).reduce(
            (acc: number, cat: any) => acc + (cat.subcategories || []).reduce(
              (a2: number, sub: any) => a2 + (sub.features?.length || 0), 0
            ), 0
          );
          const integrationCount = va.integrations?.length || 0;
          const languageCount = va.languages?.length || 0;
          const planCount = va.pricingPlans?.length || 0;

          return (
            <Link
              key={va.id}
              href={`/${platform}/research/${projectId}/virtual-apps/${va.id}`}
              className="block"
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full group">
                <CardContent className="pt-4 pb-3 px-4">
                  {/* Header: Icon + Name */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 text-lg shadow-sm"
                        style={{ backgroundColor: `${va.color || "#3B82F6"}20`, border: `1px solid ${va.color || "#3B82F6"}30` }}
                      >
                        {va.icon || "🚀"}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm leading-tight truncate">{va.name}</div>
                        {va.appCardSubtitle && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{va.appCardSubtitle}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Link
                        href={`/${platform}/research/${projectId}/virtual-apps/${va.id}/preview`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Preview"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                      {canEdit && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeleteTarget({ id: va.id, name: va.name });
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          disabled={deletingId === va.id}
                        >
                          {deletingId === va.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{featureCount} features</span>
                    <span>{integrationCount} integrations</span>
                    {languageCount > 0 && <span>{languageCount} languages</span>}
                    {planCount > 0 && <span>{planCount} plans</span>}
                  </div>

                  {/* Footer: AI badge + creator + time */}
                  <div className="mt-2 pt-2 border-t flex items-center gap-2 text-[10px]">
                    {va.generatedByAi ? (
                      <span className="inline-flex items-center gap-1 font-medium px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                        <Sparkles className="h-2.5 w-2.5" /> AI
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        Manual
                      </span>
                    )}
                    {va.creatorName && (
                      <span className="text-muted-foreground truncate">{va.creatorName}</span>
                    )}
                    <span className="text-muted-foreground ml-auto shrink-0">{timeAgo(va.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Virtual App"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        destructive
      />
    </>
  );
}

// ─── Opportunity Table ───────────────────────────────────────

function OpportunityTable({
  opportunities,
}: {
  opportunities: ResearchData["opportunities"];
}) {
  const { platform } = useParams();
  type OppSortKey = "keyword" | "opportunity" | "room" | "demand" | "competitors";
  const [sortKey, setSortKey] = useState<OppSortKey>("opportunity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: OppSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "keyword" ? "asc" : "desc");
    }
  }

  function SortIcon({ col }: { col: OppSortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="inline h-3 w-3 ml-0.5 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="inline h-3 w-3 ml-0.5" /> : <ArrowDown className="inline h-3 w-3 ml-0.5" />;
  }

  const sorted = useMemo(() => {
    return [...opportunities].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "keyword": cmp = a.keyword.localeCompare(b.keyword); break;
        case "opportunity": cmp = a.opportunityScore - b.opportunityScore; break;
        case "room": cmp = a.room - b.room; break;
        case "demand": cmp = (a.totalResults ?? -1) - (b.totalResults ?? -1); break;
        case "competitors": cmp = a.competitorCount - b.competitorCount; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [opportunities, sortKey, sortDir]);

  function roomLabel(room: number): string {
    if (room >= 0.7) return "High";
    if (room >= 0.4) return "Med";
    return "Low";
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("keyword")}>Keyword <SortIcon col="keyword" /></TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("opportunity")}>Opportunity <SortIcon col="opportunity" /></TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("room")}>Room <SortIcon col="room" /></TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("demand")}>Demand <SortIcon col="demand" /></TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("competitors")}>Competitors <SortIcon col="competitors" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((opp) => (
            <TableRow key={opp.slug}>
              <TableCell>
                <Link href={`/${platform}/keywords/${opp.slug}`} className="font-medium text-sm hover:underline">
                  {opp.keyword}
                </Link>
              </TableCell>
              <TableCell className="text-right">
                <Badge variant={opp.opportunityScore >= 60 ? "default" : "secondary"}>
                  {opp.opportunityScore}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-sm">
                <span className={opp.room >= 0.7 ? "text-green-600" : opp.room >= 0.4 ? "text-yellow-600" : "text-red-600"}>
                  {roomLabel(opp.room)}
                </span>
              </TableCell>
              <TableCell className="text-right text-sm">
                {opp.totalResults?.toLocaleString() ?? "\u2014"}
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {opp.competitorCount} rank
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
