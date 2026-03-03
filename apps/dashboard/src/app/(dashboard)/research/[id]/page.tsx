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
} from "lucide-react";
import Link from "next/link";

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
}

// ─── Main Page ───────────────────────────────────────────────

export default function ResearchProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { fetchWithAuth, user } = useAuth();

  const id = params.id as string;
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
        <Button variant="outline" onClick={() => router.push("/research")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/research" className="text-muted-foreground hover:text-foreground">
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
          <Link href={`/research/${id}/keywords`}>
            <Button variant="outline" size="sm">
              <Search className="h-3.5 w-3.5 mr-1.5" />
              {data.keywords.length} Keywords
            </Button>
          </Link>
          <Link href={`/research/${id}/competitors`}>
            <Button variant="outline" size="sm">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              {data.competitors.length} Competitors
            </Button>
          </Link>
          {hasCompetitors && (
            <Link href={`/research/${id}/compare`}>
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
          <FeatureCoverage features={data.featureCoverage} competitors={data.competitors} />
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
  const hasCompetitors = data.competitors.length >= 2;
  const hasOpportunities = data.opportunities.length > 0;
  const hasKeywords = data.keywords.length > 0;

  if (!hasCompetitors && !hasKeywords) return null;

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

  const cardCount = [hasCompetitors, hasPowers, hasOpportunities, hasDiscovery].filter(Boolean).length;
  const gridClass = cardCount <= 2 ? "grid-cols-1 md:grid-cols-2" : cardCount === 3 ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4";

  return (
    <div className={`grid ${gridClass} gap-4`}>
      {/* Card 1: Market Overview */}
      {hasCompetitors && (
        <StatCard emoji="📊" title="Market Overview" gradient="bg-gradient-to-r from-blue-500 to-cyan-400">
          {avgRating != null && (
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
                <Link href={`/research/${projectId}/keywords`} className="hover:underline">Keywords</Link>
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
                    <Link href={`/keywords/${kw.slug}`} className="hover:underline">
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
              <Link href={`/apps/${s.slug}`} className="font-medium text-sm truncate hover:underline block">{s.name}</Link>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {s.averageRating != null && (
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    {s.averageRating.toFixed(1)}
                  </span>
                )}
                {s.ratingCount != null && <span>({s.ratingCount.toLocaleString()})</span>}
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
                {app.averageRating != null && (
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
                    {app.averageRating != null && (
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
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>App</TableHead>
            <TableHead className="text-right">Rating</TableHead>
            <TableHead className="text-right">Reviews</TableHead>
            <TableHead className="text-right">Pricing</TableHead>
            <TableHead className="text-right">Power</TableHead>
            {keywords.length > 0 && <TableHead className="text-center">Rankings</TableHead>}
            <TableHead className="text-right">Featured</TableHead>
            <TableHead className="text-right">Similar</TableHead>
            <TableHead>Categories</TableHead>
            <TableHead className="text-right">Launched</TableHead>
            {canEdit && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {competitors.map((comp) => {
            const isPending = pendingCompetitors.has(comp.slug);
            const isResolved = resolvedCompetitors.has(comp.slug);
            const animate = isResolved ? "animate-in fade-in duration-700" : "";
            // Count how many keywords this competitor ranks for
            let rankCount = 0;
            for (const kwSlug of Object.keys(keywordRankings)) {
              if (keywordRankings[kwSlug]?.[comp.slug] != null) rankCount++;
            }

            return (
              <TableRow key={comp.slug} className={isPending ? "animate-in fade-in slide-in-from-top duration-300" : ""}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {comp.iconUrl ? (
                      <img src={comp.iconUrl} alt="" className="h-7 w-7 rounded" />
                    ) : (
                      <div className="h-7 w-7 rounded bg-muted" />
                    )}
                    <Link href={`/apps/${comp.slug}`} className="font-medium text-sm hover:underline">
                      {comp.name}
                    </Link>
                    {isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </div>
                </TableCell>
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
                <TableCell className="text-right">
                  {isPending ? (
                    <Skeleton className="h-4 w-12 ml-auto" />
                  ) : (
                    <span className={animate}>{comp.ratingCount?.toLocaleString() ?? "\u2014"}</span>
                  )}
                </TableCell>
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
                <TableCell className="text-right text-sm">
                  {isPending ? (
                    <Skeleton className="h-4 w-6 ml-auto" />
                  ) : comp.featuredSections > 0 ? (
                    <Link href={`/apps/${comp.slug}/featured`} className={`text-primary hover:underline ${animate}`}>{comp.featuredSections}</Link>
                  ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {isPending ? (
                    <Skeleton className="h-4 w-6 ml-auto" />
                  ) : comp.reverseSimilarCount > 0 ? (
                    <Link href={`/apps/${comp.slug}/similar`} className={`text-primary hover:underline ${animate}`}>{comp.reverseSimilarCount}</Link>
                  ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                  )}
                </TableCell>
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
                            href={`/categories/${cr.slug}`}
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
                {canEdit && (
                  <TableCell>
                    <button
                      onClick={() => onRemove(comp.slug)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
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
  const router = useRouter();
  const [addingKw, setAddingKw] = useState<string | null>(null);
  const [ensuringKw, setEnsuringKw] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
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
        router.push(`/keywords/${data.slug}`);
      }
    } finally {
      setEnsuringKw(null);
    }
  }

  const visible = expanded ? suggestions : suggestions.slice(0, INITIAL_COUNT);
  const hasMore = suggestions.length > INITIAL_COUNT;

  return (
    <div className="space-y-1">
      {visible.map((s) => (
        <div key={s.keyword} className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/50">
          <div className="flex items-center gap-3">
            <Link
              href={`/keywords/${s.slug || toSlug(s.keyword)}`}
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

// ─── Market Language (Word Cloud + Table) ────────────────────

function MarketLanguage({
  words, totalCompetitors,
}: {
  words: ResearchData["wordAnalysis"]; totalCompetitors: number;
}) {
  const maxScore = useMemo(() => Math.max(...words.map((w) => w.totalScore), 1), [words]);

  const fieldLabels: Record<string, { label: string; color: string }> = {
    name: { label: "Name", color: "bg-blue-500/20 text-blue-700" },
    subtitle: { label: "Subtitle", color: "bg-purple-500/20 text-purple-700" },
    introduction: { label: "Intro", color: "bg-green-500/20 text-green-700" },
    description: { label: "Desc", color: "bg-orange-500/20 text-orange-700" },
    categories: { label: "Cat", color: "bg-pink-500/20 text-pink-700" },
    features: { label: "Feat", color: "bg-cyan-500/20 text-cyan-700" },
    categoryFeatures: { label: "CatFeat", color: "bg-amber-500/20 text-amber-700" },
  };

  return (
    <div className="space-y-4">
      {/* Tag Cloud */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 p-4 bg-muted/30 rounded-lg">
        {words.slice(0, 30).map((w) => {
          const sizeRatio = w.totalScore / maxScore;
          const fontSize = 0.75 + sizeRatio * 1;
          const opacity = 0.4 + (w.appCount / totalCompetitors) * 0.6;
          const slug = w.word.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
          return (
            <Link
              key={w.word}
              href={`/keywords/${slug}`}
              className="inline-block leading-tight font-medium hover:underline"
              style={{ fontSize: `${fontSize}rem`, opacity }}
            >
              {w.word}
            </Link>
          );
        })}
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Term</TableHead>
            <TableHead className="text-right">Apps</TableHead>
            <TableHead>Fields</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {words.slice(0, 20).map((w) => (
            <TableRow key={w.word}>
              <TableCell className="font-medium text-sm">
                <Link
                  href={`/keywords/${w.word.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}`}
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
            <Link href={`/categories/${cat.slug}`} className="font-medium text-sm hover:underline">
              {cat.title}
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
                  <Link href={`/apps/${c.slug}`} className="flex items-center gap-2 min-w-0 flex-1 group">
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
  features, competitors,
}: {
  features: ResearchData["featureCoverage"];
  competitors: ResearchData["competitors"];
}) {
  const competitorSet = useMemo(
    () => new Set(features.flatMap((f) => f.competitors)),
    [features]
  );
  const relevantCompetitors = useMemo(
    () => competitors.filter((c) => competitorSet.has(c.slug)),
    [competitors, competitorSet]
  );

  // Group features by categoryType → subcategoryTitle
  const grouped = useMemo(() => {
    const typeOrder = ["primary", "secondary", "other"];
    const typeMap = new Map<string, Map<string, typeof features>>();

    for (const f of features) {
      const catType = f.categoryType || "other";
      const subTitle = f.subcategoryTitle || "Other";
      if (!typeMap.has(catType)) typeMap.set(catType, new Map());
      const subMap = typeMap.get(catType)!;
      if (!subMap.has(subTitle)) subMap.set(subTitle, []);
      subMap.get(subTitle)!.push(f);
    }

    const result: { type: string; categoryTitle: string; subcategories: { title: string; features: typeof features }[] }[] = [];

    for (const type of typeOrder) {
      const subMap = typeMap.get(type);
      if (!subMap) continue;
      // Get categoryTitle from first feature in this type
      const firstFeature = [...subMap.values()][0]?.[0];
      const categoryTitle = firstFeature?.categoryTitle || type;
      const subcategories = [...subMap.entries()]
        .map(([title, feats]) => ({ title, features: feats.sort((a, b) => b.count - a.count) }))
        .sort((a, b) => {
          const avgA = a.features.reduce((s, f) => s + f.count, 0) / a.features.length;
          const avgB = b.features.reduce((s, f) => s + f.count, 0) / b.features.length;
          return avgB - avgA;
        });
      result.push({ type, categoryTitle, subcategories });
    }

    return result;
  }, [features]);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[220px] min-w-[160px]">Feature</TableHead>
            {relevantCompetitors.map((comp) => (
              <TableHead key={comp.slug} className="text-center px-2">
                <Link href={`/apps/${comp.slug}`} className="inline-flex flex-col items-center gap-1 group" title={comp.name}>
                  {comp.iconUrl ? (
                    <img src={comp.iconUrl} alt={comp.name} className="h-7 w-7 rounded group-hover:ring-2 ring-primary/50 transition-all" />
                  ) : (
                    <div className="h-7 w-7 rounded bg-muted group-hover:ring-2 ring-primary/50 transition-all" />
                  )}
                </Link>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped.map((group) => (
            group.subcategories.map((sub, si) => (
              <React.Fragment key={`${group.type}-${sub.title}`}>
                {/* Subcategory header row */}
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={relevantCompetitors.length + 1} className="py-1.5">
                    <span className="text-xs font-semibold text-foreground">{sub.title}</span>
                  </TableCell>
                </TableRow>
                {/* Feature rows */}
                {sub.features.map((f) => (
                  <TableRow key={f.feature}>
                    <TableCell className="text-sm truncate pl-6" title={f.title}>
                      <Link href={`/features/${encodeURIComponent(f.feature)}`} className="hover:underline">
                        {f.title}
                      </Link>
                      <span className="ml-1 text-xs text-muted-foreground">({f.count}/{f.total})</span>
                    </TableCell>
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
            ))
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Opportunity Table ───────────────────────────────────────

function OpportunityTable({
  opportunities,
}: {
  opportunities: ResearchData["opportunities"];
}) {
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
            <TableHead>Keyword</TableHead>
            <TableHead className="text-right">Opportunity</TableHead>
            <TableHead className="text-right">Room</TableHead>
            <TableHead className="text-right">Demand</TableHead>
            <TableHead className="text-right">Competitors</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {opportunities.map((opp) => (
            <TableRow key={opp.slug}>
              <TableCell>
                <Link href={`/keywords/${opp.slug}`} className="font-medium text-sm hover:underline">
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
