"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { PLATFORMS, isPlatformId, type PlatformId } from "@appranks/shared";
import type { ResearchData } from "./research-types";
import { formatNumber } from "@/lib/format-utils";
import { useFeatureFlag } from "@/contexts/feature-flags-context";

// ─── Helpers ──────────────────────────────────────────────────

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── Internal Components ──────────────────────────────────────

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

// ─── SummaryCards ─────────────────────────────────────────────

export function SummaryCards({ data }: { data: ResearchData }) {
  const hasKeywordScore = useFeatureFlag("keyword-score");
  const { platform } = useParams();
  const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const hasCompetitors = data.competitors.length >= 2;
  const hasOpportunities = hasKeywordScore && data.opportunities.length > 0;
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
              <span className="font-medium text-xs">{avgReviews != null ? formatNumber(avgReviews) : "—"} reviews</span>
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
