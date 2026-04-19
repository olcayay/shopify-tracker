"use client";

import { useEffect, useState } from "react";
import Link from "@/components/ui/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FlaskConical, Trash2, User, Star, Pencil, Check, X } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";
import { formatNumber, formatFullDate } from "@/lib/format-utils";
import { useFeatureFlag } from "@/contexts/feature-flags-context";

// ─── Types ──────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  creatorName: string | null;
  createdAt: string;
  updatedAt: string;
}

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
    id: string; name: string; icon: string; color: string;
    features: string[]; integrations: string[]; categories: any[];
  }[];
}

// ─── Main Page ──────────────────────────────────────────────

export default function ResearchListPage() {
  const { fetchWithAuth, user, account } = useAuth();
  const { platform } = useParams();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectDataMap, setProjectDataMap] = useState<Record<string, ResearchData>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameValue, setNameValue] = useState("");
  const [limitReached, setLimitReached] = useState(false);

  const canEdit = user?.role === "owner" || user?.role === "admin" || user?.role === "editor";

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const res = await fetchWithAuth("/api/research-projects");
      if (res.ok) {
        const data: Project[] = await res.json();
        setProjects(data);
        // Fetch full data for each project in parallel
        const results = await Promise.allSettled(
          data.map(async (p) => {
            const r = await fetchWithAuth(`/api/research-projects/${p.id}/data`);
            if (r.ok) return { id: p.id, data: await r.json() as ResearchData };
            return null;
          })
        );
        const map: Record<string, ResearchData> = {};
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) {
            map[r.value.id] = r.value.data;
          }
        }
        setProjectDataMap(map);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    setCreating(true);
    try {
      const res = await fetchWithAuth("/api/research-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const project = await res.json();
        router.push(`/${platform}/research/${project.id}`);
      } else if (res.status === 403) {
        setLimitReached(true);
      }
    } finally {
      setCreating(false);
    }
  }

  async function deleteProject(id: string) {
    const res = await fetchWithAuth(`/api/research-projects/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setProjectDataMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    setDeleteTarget(null);
  }

  async function renameProject(id: string) {
    const trimmed = nameValue.trim();
    if (!trimmed) { setEditingId(null); return; }
    const res = await fetchWithAuth(`/api/research-projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      setProjects((prev) => prev.map((p) => p.id === id ? { ...p, name: trimmed } : p));
    }
    setEditingId(null);
  }

  function formatDate(date: string) {
    return formatFullDate(date);
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">
          Research Projects
          {account && (
            <span className="text-lg text-muted-foreground font-normal ml-2">
              ({account.usage.researchProjects}/{account.limits.maxResearchProjects})
            </span>
          )}
        </h1>
        <TableSkeleton rows={3} cols={3} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          Research Projects
          {loading ? (
            <Skeleton className="inline-block h-5 w-14 align-middle ml-2" />
          ) : account ? (
            <span className="text-lg text-muted-foreground font-normal ml-2">
              ({account.usage.researchProjects}/{account.limits.maxResearchProjects})
            </span>
          ) : null}
        </h1>
        {canEdit && (
          <div className="flex items-center gap-3">
            {limitReached && (
              <span className="text-sm text-destructive">Research project limit reached</span>
            )}
            <Button onClick={createProject} disabled={creating || limitReached}>
              <Plus className="h-4 w-4 mr-2" />
              {creating ? "Creating..." : "New Project"}
            </Button>
          </div>
        )}
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FlaskConical className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">No research projects yet</h2>
            <p className="text-muted-foreground text-sm mb-6 text-center max-w-md">
              Start a research project to explore market opportunities. Add keywords and discover competitors, categories, and feature gaps.
            </p>
            {canEdit && (
              <Button onClick={createProject} disabled={creating}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {projects.map((p) => {
            const data = projectDataMap[p.id];
            return (
              <Link key={p.id} href={`/${platform}/research/${p.id}`} className="block">
                <Card className="hover:border-primary/50 transition-colors cursor-pointer group overflow-hidden">
                  {/* Title row */}
                  <div className="flex items-center justify-between px-5 pt-4 pb-3">
                    {editingId === p.id ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                        <Input
                          value={nameValue}
                          onChange={(e) => setNameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") renameProject(p.id); if (e.key === "Escape") setEditingId(null); }}
                          className="text-lg font-semibold h-auto py-1"
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" onClick={() => renameProject(p.id)}><Check className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          if (!canEdit) return;
                          e.preventDefault();
                          e.stopPropagation();
                          setNameValue(p.name);
                          setEditingId(p.id);
                        }}
                        className="flex items-center gap-2 group/title min-w-0"
                      >
                        <h3 className="text-lg font-semibold truncate">{p.name}</h3>
                        {canEdit && <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />}
                      </button>
                    )}
                    {canEdit && editingId !== p.id && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteTarget(p);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Summary cards — same as detail page */}
                  <div className="px-5 pb-3">
                    {data ? (
                      <ProjectSummaryCards data={data} />
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                          <Skeleton key={i} className="h-32 rounded-lg" />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer: creator + dates */}
                  <div className="px-5 pb-4 flex items-center gap-4 text-xs text-muted-foreground">
                    {p.creatorName && (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {p.creatorName}
                      </span>
                    )}
                    <span>Created {formatDate(p.createdAt)}</span>
                    <span>Updated {formatDate(p.updatedAt)}</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Research Project"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && deleteProject(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── Summary Cards (same logic as detail page) ─────────────

function ProjectSummaryCards({ data }: { data: ResearchData }) {
  const hasKeywordScore = useFeatureFlag("keyword-score");
  const hasCompetitors = data.competitors.length >= 2;
  const hasOpportunities = hasKeywordScore && data.opportunities.length > 0;
  const hasKeywords = data.keywords.length > 0;
  const hasVirtualApps = (data.virtualApps?.length ?? 0) > 0;

  if (!hasCompetitors && !hasKeywords && !hasVirtualApps) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No keywords or competitors added yet.
      </div>
    );
  }

  const comps = data.competitors;
  const ratings = comps.filter((c) => c.averageRating != null);
  const avgRating = ratings.length > 0 ? ratings.reduce((s, c) => s + c.averageRating!, 0) / ratings.length : null;
  const avgReviews = ratings.length > 0 ? Math.round(ratings.reduce((s, c) => s + (c.ratingCount ?? 0), 0) / ratings.length) : null;
  const prices = comps.map((c) => c.minPaidPrice).filter((p): p is number => p != null);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
  const powers = comps.map((c) => c.powerScore).filter((p): p is number => p != null);
  const avgPower = powers.length > 0 ? Math.round(powers.reduce((a, b) => a + b, 0) / powers.length) : null;
  const strongest = powers.length > 0 ? comps.reduce((a, b) => (b.powerScore ?? 0) > (a.powerScore ?? 0) ? b : a) : null;
  const top3 = [...comps].filter((c) => c.powerScore != null).sort((a, b) => (b.powerScore ?? 0) - (a.powerScore ?? 0)).slice(0, 3);
  const maxPower = top3.length > 0 ? (top3[0].powerScore ?? 1) : 1;
  const bestOpp = data.opportunities.length > 0 ? data.opportunities[0] : null;
  const highOppCount = data.opportunities.filter((o) => o.opportunityScore >= 60).length;
  const gapCount = data.featureCoverage.filter((f) => f.isGap).length;
  const hasDiscovery = hasKeywords && (data.competitorSuggestions.length > 0 || data.keywordSuggestions.length > 0 || data.wordAnalysis.length > 0);
  const hasPowers = hasCompetitors && powers.length > 0;

  const cardCount = [hasCompetitors, hasPowers, hasOpportunities, hasDiscovery, hasVirtualApps].filter(Boolean).length;
  const gridClass = cardCount <= 2 ? "grid-cols-1 md:grid-cols-2" : cardCount <= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-5";

  return (
    <div className={`grid ${gridClass} gap-4`}>
      {/* Card 1: Market Overview */}
      {hasCompetitors && (
        <StatCard emoji="📊" title="Market Overview" gradient="bg-gradient-to-r from-blue-500 to-cyan-400">
          {avgRating != null && (
            <StatRow>
              <span className="text-muted-foreground flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{avgRating.toFixed(1)} avg rating
              </span>
              <span className="font-medium text-xs">{avgReviews != null ? formatNumber(avgReviews) : "—"} reviews</span>
            </StatRow>
          )}
          <StatRow>
            <span className="text-muted-foreground">
              {minPrice != null && maxPrice != null ? `$${minPrice} — $${maxPrice}/mo` : "No pricing data"}
            </span>
          </StatRow>
          {data.categories.length > 0 && (
            <StatRow>
              <span className="text-muted-foreground">{data.categories.length} categories</span>
            </StatRow>
          )}
        </StatCard>
      )}

      {/* Card 2: Competition */}
      {hasPowers && (
        <StatCard emoji="⚔️" title="Competition" gradient="bg-gradient-to-r from-orange-500 to-amber-400">
          <StatRow>
            <span className="text-muted-foreground">{avgPower} avg power</span>
            <span className="font-medium text-xs">{strongest?.powerScore} strongest</span>
          </StatRow>
          {top3.map((c) => (
            <div key={c.slug} className="flex items-center w-full px-2 py-1 -mx-2">
              <span className="text-xs text-muted-foreground w-24 truncate">{c.name}</span>
              <div className="flex-1 mx-2 h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full" style={{ width: `${((c.powerScore ?? 0) / maxPower) * 100}%` }} />
              </div>
              <span className="text-xs font-medium w-6 text-right">{c.powerScore}</span>
            </div>
          ))}
        </StatCard>
      )}

      {/* Card 3: Opportunities */}
      {hasOpportunities && (
        <StatCard emoji="🚀" title="Opportunities" gradient="bg-gradient-to-r from-emerald-500 to-green-400">
          {bestOpp && (
            <StatRow>
              <span className="text-muted-foreground truncate mr-2">Best: &quot;{bestOpp.keyword}&quot;</span>
              <Badge variant="secondary" className="text-xs shrink-0">{bestOpp.opportunityScore}</Badge>
            </StatRow>
          )}
          <StatRow>
            <span className="text-muted-foreground">{highOppCount} high opportunities</span>
          </StatRow>
          {gapCount > 0 && (
            <StatRow>
              <span className="text-muted-foreground">{gapCount} feature gaps</span>
            </StatRow>
          )}
        </StatCard>
      )}

      {/* Card 4: Discovery */}
      {hasDiscovery && (
        <StatCard emoji="💡" title="Discovery" gradient="bg-gradient-to-r from-violet-500 to-purple-400">
          {data.competitorSuggestions.length > 0 && (
            <StatRow>
              <span className="text-muted-foreground">{data.competitorSuggestions.length} app suggestions</span>
            </StatRow>
          )}
          {data.keywordSuggestions.length > 0 && (
            <StatRow>
              <span className="text-muted-foreground">{data.keywordSuggestions.length} keyword ideas</span>
            </StatRow>
          )}
          {data.wordAnalysis.length > 0 && (
            <StatRow>
              <span className="text-muted-foreground">{data.wordAnalysis.length} market terms</span>
            </StatRow>
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
              <StatRow key={va.id}>
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
              </StatRow>
            );
          })}
        </StatCard>
      )}
    </div>
  );
}

function StatCard({ emoji, title, gradient, children }: {
  emoji: string; title: string; gradient: string; children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-sm">
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

function StatRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between w-full rounded-md px-2 py-1 -mx-2">
      {children}
    </div>
  );
}
