"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { X, ExternalLink } from "lucide-react";
import { buildExternalAppUrl, getPlatformName, formatCategoryTitle } from "@/lib/platform-urls";
import type { PlatformId } from "@appranks/shared";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { VelocityCell } from "@/components/velocity-cell";
import { MomentumBadge } from "@/components/momentum-badge";
import { VisibilityScorePopover } from "@/components/visibility-score-popover";
import { WeightedPowerPopover } from "@/components/power-score-popover";

interface CompetitorRowProps {
  c: any;
  myAppSlug: string;
  platform: string;
  isCol: (key: string) => boolean;
  canEdit: boolean;
  caps: any;
  formatDateOnly: (date: string) => string;
  onRemove: (slug: string, name: string, trackedAppSlug: string) => void;
}

export function CompetitorRow({ c, myAppSlug, platform, isCol, canEdit, caps, formatDateOnly, onRemove }: CompetitorRowProps) {
  return (
    <TableRow key={`${myAppSlug}-${c.appSlug}`}>
      <TableCell className="max-w-[260px] md:sticky md:left-0 md:z-10 bg-background md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-2">
          {c.iconUrl && (
            <img
              src={c.iconUrl}
              alt="" aria-hidden="true"
              className="h-6 w-6 rounded shrink-0"
            />
          )}
          <div className="flex items-center gap-1.5 min-w-0">
            <Link
              href={`/${platform}/apps/${c.appSlug}`}
              className="text-primary hover:underline font-medium truncate"
            >
              {c.appName || c.appSlug}
            </Link>
            {c.isBuiltForShopify && (
              <span title="Built for Shopify" className="shrink-0">💎</span>
            )}
          </div>
        </div>
      </TableCell>
      {isCol("visibility") && (
        <TableCell className="text-sm">
          {c.visibilityScore != null ? (
            <VisibilityScorePopover
              visibilityScore={c.visibilityScore}
              keywordCount={c.visibilityKeywordCount ?? 0}
              visibilityRaw={c.visibilityRaw ?? 0}
            >
              <span className="text-blue-600 dark:text-blue-400 font-medium cursor-help border-b border-dotted border-blue-400/50">
                {c.visibilityScore}
              </span>
            </VisibilityScorePopover>
          ) : (
            <span className="text-muted-foreground">{"\u2014"}</span>
          )}
        </TableCell>
      )}
      {isCol("power") && (
        <TableCell className="text-sm">
          {c.weightedPowerScore != null && c.powerCategories?.length > 0 ? (
            <WeightedPowerPopover
              weightedPowerScore={c.weightedPowerScore}
              powerCategories={c.powerCategories}
            >
              <span className="text-purple-600 dark:text-purple-400 font-medium cursor-help border-b border-dotted border-purple-400/50">
                {c.weightedPowerScore}
              </span>
            </WeightedPowerPopover>
          ) : (
            <span className="text-purple-600 dark:text-purple-400 font-medium">
              {c.weightedPowerScore != null ? c.weightedPowerScore : "\u2014"}
            </span>
          )}
        </TableCell>
      )}
      {isCol("similarity") && (
        <TableCell className="text-sm">
          {c.similarityScore ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        parseFloat(c.similarityScore.overall) >= 0.7 ? "bg-red-500" :
                        parseFloat(c.similarityScore.overall) >= 0.4 ? "bg-amber-500" :
                        "bg-emerald-500"
                      }`}
                      style={{ width: `${(parseFloat(c.similarityScore.overall) * 100).toFixed(0)}%` }}
                    />
                  </div>
                  <span className="tabular-nums font-medium">
                    {(parseFloat(c.similarityScore.overall) * 100).toFixed(0)}%
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-1">
                  <div>Category: {(parseFloat(c.similarityScore.category) * 100).toFixed(0)}%</div>
                  {caps.hasFeatureTaxonomy && <div>Features: {(parseFloat(c.similarityScore.feature) * 100).toFixed(0)}%</div>}
                  <div>Keywords: {(parseFloat(c.similarityScore.keyword) * 100).toFixed(0)}%</div>
                  <div>Text: {(parseFloat(c.similarityScore.text) * 100).toFixed(0)}%</div>
                </div>
              </TooltipContent>
            </Tooltip>
          ) : "\u2014"}
        </TableCell>
      )}
      {isCol("rating") && (
        <TableCell>
          {c.latestSnapshot?.averageRating ?? "\u2014"}
        </TableCell>
      )}
      {isCol("reviews") && (
        <TableCell>
          {c.latestSnapshot?.ratingCount != null ? (
            <Link href={`/${platform}/apps/${c.appSlug}/reviews`} className="text-primary hover:underline">
              {c.latestSnapshot.ratingCount}
            </Link>
          ) : "\u2014"}
        </TableCell>
      )}
      {isCol("v7d") && (
        <TableCell className="text-sm">
          <VelocityCell value={c.reviewVelocity?.v7d} />
        </TableCell>
      )}
      {isCol("v30d") && (
        <TableCell className="text-sm">
          <VelocityCell value={c.reviewVelocity?.v30d} />
        </TableCell>
      )}
      {isCol("v90d") && (
        <TableCell className="text-sm">
          <VelocityCell value={c.reviewVelocity?.v90d} />
        </TableCell>
      )}
      {isCol("momentum") && (
        <TableCell className="text-sm text-center">
          <MomentumBadge momentum={c.reviewVelocity?.momentum} />
        </TableCell>
      )}
      {isCol("pricing") && (
        <TableCell className="text-sm whitespace-nowrap">
          {(() => {
            const p = c.latestSnapshot?.pricing;
            if (!p) return "\u2014";
            const abbr: Record<string, string> = {
              "Free plan available": "Free plan",
              "Free to install": "Free install",
              "Free trial available": "Free trial",
            };
            const short = abbr[p];
            if (!short) return p;
            return (
              <Tooltip>
                <TooltipTrigger asChild><span>{short}</span></TooltipTrigger>
                <TooltipContent>{p}</TooltipContent>
              </Tooltip>
            );
          })()}
        </TableCell>
      )}
      {isCol("minPaidPrice") && (
        <TableCell className="text-sm">
          {c.minPaidPrice != null ? (
            <Link href={`/${platform}/apps/${c.appSlug}/details#pricing-plans`} className="text-primary hover:underline">
              ${c.minPaidPrice}/mo
            </Link>
          ) : "\u2014"}
        </TableCell>
      )}
      {isCol("launchedDate") && (
        <TableCell className="text-sm text-muted-foreground">
          {c.launchedDate
            ? formatDateOnly(c.launchedDate)
            : "\u2014"}
        </TableCell>
      )}
      {isCol("featured") && (
        <TableCell className="text-sm">
          {c.featuredSections > 0 ? (
            <Link href={`/${platform}/apps/${c.appSlug}/featured`} className="text-primary hover:underline">
              {c.featuredSections}
            </Link>
          ) : <span className="text-muted-foreground">{"\u2014"}</span>}
        </TableCell>
      )}
      {isCol("adKeywords") && (
        <TableCell className="text-sm">
          {c.adKeywords > 0 ? (
            <Link href={`/${platform}/apps/${c.appSlug}/ads`} className="text-primary hover:underline">
              {c.adKeywords}
            </Link>
          ) : <span className="text-muted-foreground">{"\u2014"}</span>}
        </TableCell>
      )}
      {isCol("rankedKeywords") && (
        <TableCell className="text-sm">
          {(c.rankedKeywords ?? 0) > 0 ? (
            <Link href={`/${platform}/apps/${c.appSlug}/keywords`} className="text-primary hover:underline">
              {c.rankedKeywords}
            </Link>
          ) : <span className="text-muted-foreground">{"\u2014"}</span>}
        </TableCell>
      )}
      {isCol("similar") && (
        <TableCell className="text-sm">
          {(c.reverseSimilarCount ?? 0) > 0 ? (
            <Link href={`/${platform}/apps/${c.appSlug}/similar`} className="text-primary hover:underline">
              {c.reverseSimilarCount}
            </Link>
          ) : <span className="text-muted-foreground">{"\u2014"}</span>}
        </TableCell>
      )}
      {isCol("catRank") && (
        <TableCell className="text-sm">
          {(() => {
            const rankings: any[] = c.categoryRankings ?? [];
            const primary = c.categories?.find((cat: any) => cat.type === "primary");
            const secondary = c.categories?.find((cat: any) => cat.type === "secondary");

            // If no primary/secondary categories, fall back to showing rankings directly
            if (!primary && !secondary) {
              if (!rankings.length) return "\u2014";
              return (
                <div>
                  {rankings.map((cr: any) => {
                    const change = cr.prevPosition != null ? cr.prevPosition - cr.position : null;
                    const topPercent = cr.appCount != null && cr.appCount > 0
                      ? Math.max(1, Math.ceil((cr.position / cr.appCount) * 100))
                      : null;
                    return (
                      <div key={cr.categorySlug} className="flex items-center gap-1.5">
                        <span className="font-semibold tabular-nums shrink-0">#{cr.position}</span>
                        {change != null && change !== 0 && (
                          <span className={`text-xs font-medium shrink-0 ${change > 0 ? "text-green-600" : "text-red-500"}`}>
                            {change > 0 ? "\u2191" : "\u2193"}{Math.abs(change)}
                          </span>
                        )}
                        <Link href={`/${platform}/categories/${cr.categorySlug}`} className="hover:underline truncate text-primary">{formatCategoryTitle(platform as PlatformId, cr.categorySlug, cr.categoryTitle)}</Link>
                        {topPercent != null && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`text-xs px-1 py-0.5 rounded shrink-0 ${topPercent <= 5 ? "bg-emerald-500/10 text-emerald-600" : topPercent <= 20 ? "bg-blue-500/10 text-blue-600" : "bg-muted text-muted-foreground"}`}>
                                Top {topPercent}%
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Rank {cr.position} of {cr.appCount} apps
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }

            const rankMap = new Map<string, { position: number; prevPosition: number | null; appCount: number | null }>(
              rankings.map((cr: any) => [
                cr.categorySlug,
                { position: cr.position, prevPosition: cr.prevPosition ?? null, appCount: cr.appCount ?? null },
              ])
            );

            function renderCategory(cat: { slug: string; title: string }, isPrimary: boolean) {
              const rank = rankMap.get(cat.slug);
              const change = rank && rank.prevPosition != null ? rank.prevPosition - rank.position : null;
              const topPercent = rank && rank.appCount != null && rank.appCount > 0
                ? Math.max(1, Math.ceil((rank.position / rank.appCount) * 100))
                : null;
              return (
                <div className={`flex items-center gap-1.5 ${isPrimary ? "" : "mt-1"}`}>
                  {rank && <span className={`font-semibold tabular-nums shrink-0 ${isPrimary ? "" : "text-muted-foreground"}`}>#{rank.position}</span>}
                  {change != null && change !== 0 && (
                    <span className={`text-xs font-medium shrink-0 ${change > 0 ? "text-green-600" : "text-red-500"}`}>
                      {change > 0 ? "\u2191" : "\u2193"}{Math.abs(change)}
                    </span>
                  )}
                  {cat.slug ? <Link href={`/${platform}/categories/${cat.slug}`} className={`hover:underline truncate ${isPrimary ? "text-primary" : "text-muted-foreground"}`}>{formatCategoryTitle(platform as PlatformId, cat.slug, cat.title)}</Link> : <span className={isPrimary ? "" : "text-muted-foreground"}>{cat.title}</span>}
                  {topPercent != null && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`text-xs px-1 py-0.5 rounded shrink-0 ${topPercent <= 5 ? "bg-emerald-500/10 text-emerald-600" : topPercent <= 20 ? "bg-blue-500/10 text-blue-600" : "bg-muted text-muted-foreground"}`}>
                          Top {topPercent}%
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Rank {rank!.position} of {rank!.appCount} apps
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              );
            }

            return (
              <div>
                {primary && renderCategory(primary, true)}
                {secondary && renderCategory(secondary, false)}
              </div>
            );
          })()}
        </TableCell>
      )}
      {isCol("lastChangeAt") && (
        <TableCell className="text-sm">
          {c.lastChangeAt ? (
            <Link href={`/${platform}/apps/${c.appSlug}/changes`} className="text-primary hover:underline">
              {formatDateOnly(c.lastChangeAt)}
            </Link>
          ) : "\u2014"}
        </TableCell>
      )}
      <TableCell>
        <a
          href={buildExternalAppUrl(platform as PlatformId, c.appSlug, c.externalId)}
          target="_blank"
          rel="noopener noreferrer"
          title={`View on ${getPlatformName(platform as PlatformId)}`}
        >
          <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </a>
      </TableCell>
      {canEdit && (
        <TableCell>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() =>
              onRemove(c.appSlug, c.appName || c.appSlug, myAppSlug)
            }
          >
            <X className="h-4 w-4" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}
