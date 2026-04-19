"use client";

import Link from "@/components/ui/link";
import { Button } from "@/components/ui/button";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { X, ChevronUp, ChevronDown, Pin, PinOff, ExternalLink, Loader2 } from "lucide-react";
import { buildExternalAppUrl, formatCategoryTitle } from "@/lib/platform-urls";
import type { PlatformId } from "@appranks/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { VelocityCell } from "@/components/velocity-cell";
import { MomentumBadge } from "@/components/momentum-badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { VisibilityScorePopover } from "@/components/visibility-score-popover";
import { WeightedPowerPopover } from "@/components/power-score-popover";
import { useLayoutVersion, buildAppLink } from "@/hooks/use-layout-version";

export function CompetitorTableRowItem({
  comp,
  idx,
  competitorNum,
  platform,
  canEdit,
  isCol,
  isCustomOrder,
  selfPinned,
  reordering,
  competitors,
  isPending,
  isResolved,
  caps,
  lastChanges,
  formatDateOnly,
  toggleSelfPinned,
  moveCompetitor,
  setConfirmRemove,
}: {
  comp: any;
  idx: number;
  competitorNum: number;
  platform: string;
  canEdit: boolean;
  isCol: (key: string) => boolean;
  isCustomOrder: boolean;
  selfPinned: boolean;
  reordering: boolean;
  competitors: any[];
  isPending: boolean;
  isResolved: boolean;
  caps: any;
  lastChanges: Record<string, string>;
  formatDateOnly: (d: string) => string;
  toggleSelfPinned: () => void;
  moveCompetitor: (index: number, direction: "up" | "down") => void;
  setConfirmRemove: (v: { slug: string; name: string } | null) => void;
}) {
  const version = useLayoutVersion();

  return (
    <TableRow className={cn(
      comp.isSelf && "border-l-2 border-l-emerald-500 bg-emerald-500/10",
      isPending && "animate-in fade-in slide-in-from-top duration-300",
    )}>
      {canEdit && (
        <TableCell className={`py-1 md:sticky md:left-0 md:z-10 ${comp.isSelf ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-background"}`}>
          {comp.isSelf ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors"
                  onClick={toggleSelfPinned}
                >
                  {selfPinned
                    ? <Pin className="h-3.5 w-3.5 text-emerald-500" />
                    : <PinOff className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {selfPinned ? "Unpin: sort this app with competitors" : "Pin: keep this app at the top"}
              </TooltipContent>
            </Tooltip>
          ) : isCustomOrder ? (
            <div className="flex flex-col items-center gap-0">
              <button
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent disabled:opacity-20 transition-colors"
                disabled={idx === 0 || reordering}
                onClick={() => moveCompetitor(idx, "up")}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent disabled:opacity-20 transition-colors"
                disabled={idx === competitors.length - 1 || reordering}
                onClick={() => moveCompetitor(idx, "down")}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{competitorNum}</span>
          )}
        </TableCell>
      )}
      <TableCell className={`max-w-[260px] md:sticky md:z-10 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${canEdit ? "md:left-12" : "md:left-0"} ${comp.isSelf ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-background"}`}>
        <div className="flex items-center gap-2">
          {comp.iconUrl && (
            <img
              src={comp.iconUrl}
              alt="" aria-hidden="true"
              className="h-6 w-6 rounded shrink-0"
            />
          )}
          <div className="flex items-center gap-1.5 min-w-0">
            <Link
              href={buildAppLink(platform, comp.appSlug, "", version)}
              className="text-primary hover:underline font-medium truncate"
            >
              {comp.appName}
            </Link>
            {comp.isBuiltForShopify && (
              <span title="Built for Shopify">💎</span>
            )}
            {isPending && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      </TableCell>
      {isCol("visibility") && <TableCell className="text-sm">
        {isPending ? <Skeleton className="h-4 w-10" /> : comp.visibilityScore != null ? (
          <VisibilityScorePopover
            visibilityScore={comp.visibilityScore}
            keywordCount={comp.visibilityKeywordCount ?? 0}
            visibilityRaw={comp.visibilityRaw ?? 0}
          >
            <span className="text-blue-600 dark:text-blue-400 font-medium cursor-help border-b border-dotted border-blue-400/50">
              {comp.visibilityScore}
            </span>
          </VisibilityScorePopover>
        ) : (
          <span className="text-muted-foreground">{"\u2014"}</span>
        )}
      </TableCell>}
      {isCol("power") && <TableCell className="text-sm">
        {isPending ? <Skeleton className="h-4 w-10" /> : comp.weightedPowerScore != null && comp.powerCategories?.length > 0 ? (
          <WeightedPowerPopover
            weightedPowerScore={comp.weightedPowerScore}
            powerCategories={comp.powerCategories}
            hasReviews={caps.hasReviews}
          >
            <span className="text-purple-600 dark:text-purple-400 font-medium cursor-help border-b border-dotted border-purple-400/50">
              {comp.weightedPowerScore}
            </span>
          </WeightedPowerPopover>
        ) : (
          <span className="text-purple-600 dark:text-purple-400 font-medium">
            {comp.weightedPowerScore != null ? comp.weightedPowerScore : "\u2014"}
          </span>
        )}
      </TableCell>}
      {isCol("similarity") && <TableCell className="text-sm">
        {isPending ? (
          <Skeleton className="h-4 w-16" />
        ) : isResolved ? (
          <span className="animate-in fade-in duration-700">
            {comp.isSelf ? "\u2014" : comp.similarityScore ? `${(parseFloat(comp.similarityScore.overall) * 100).toFixed(0)}%` : "\u2014"}
          </span>
        ) : comp.isSelf ? "\u2014" : comp.similarityScore ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      parseFloat(comp.similarityScore.overall) >= 0.7 ? "bg-red-500" :
                      parseFloat(comp.similarityScore.overall) >= 0.4 ? "bg-amber-500" :
                      "bg-emerald-500"
                    }`}
                    style={{ width: `${(parseFloat(comp.similarityScore.overall) * 100).toFixed(0)}%` }}
                  />
                </div>
                <span className="tabular-nums font-medium">
                  {(parseFloat(comp.similarityScore.overall) * 100).toFixed(0)}%
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs space-y-1">
                <div>{platform === "wordpress" ? "Tags" : "Category"}: {(parseFloat(comp.similarityScore.category) * 100).toFixed(0)}%</div>
                {caps.hasFeatureTaxonomy && <div>Features: {(parseFloat(comp.similarityScore.feature) * 100).toFixed(0)}%</div>}
                <div>Keywords: {(parseFloat(comp.similarityScore.keyword) * 100).toFixed(0)}%</div>
                <div>Text: {(parseFloat(comp.similarityScore.text) * 100).toFixed(0)}%</div>
              </div>
            </TooltipContent>
          </Tooltip>
        ) : "\u2014"}
      </TableCell>}
      {isCol("rating") && <TableCell>
        {comp.latestSnapshot?.averageRating ?? "\u2014"}
      </TableCell>}
      {isCol("reviews") && <TableCell>
        {comp.latestSnapshot?.ratingCount != null ? (
          <Link href={buildAppLink(platform, comp.appSlug, "reviews", version)} className="text-primary hover:underline">
            {comp.latestSnapshot.ratingCount}
          </Link>
        ) : "\u2014"}
      </TableCell>}
      {isCol("v7d") && <TableCell className="text-sm">
        {isPending ? <Skeleton className="h-4 w-8" /> : isResolved ? (
          <span className="animate-in fade-in duration-700"><VelocityCell value={comp.reviewVelocity?.v7d} /></span>
        ) : <VelocityCell value={comp.reviewVelocity?.v7d} />}
      </TableCell>}
      {isCol("v30d") && <TableCell className="text-sm">
        {isPending ? <Skeleton className="h-4 w-8" /> : isResolved ? (
          <span className="animate-in fade-in duration-700"><VelocityCell value={comp.reviewVelocity?.v30d} /></span>
        ) : <VelocityCell value={comp.reviewVelocity?.v30d} />}
      </TableCell>}
      {isCol("v90d") && <TableCell className="text-sm">
        {isPending ? <Skeleton className="h-4 w-8" /> : isResolved ? (
          <span className="animate-in fade-in duration-700"><VelocityCell value={comp.reviewVelocity?.v90d} /></span>
        ) : <VelocityCell value={comp.reviewVelocity?.v90d} />}
      </TableCell>}
      {isCol("momentum") && <TableCell className="text-sm text-center">
        {isPending ? <Skeleton className="h-4 w-16 mx-auto" /> : isResolved ? (
          <span className="animate-in fade-in duration-700"><MomentumBadge momentum={comp.reviewVelocity?.momentum} /></span>
        ) : <MomentumBadge momentum={comp.reviewVelocity?.momentum} />}
      </TableCell>}
      {isCol("pricing") && <TableCell className="text-sm whitespace-nowrap">
        {(() => {
          const p = comp.latestSnapshot?.pricing;
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
      </TableCell>}
      {isCol("minPaidPrice") && <TableCell className="text-sm">
        {comp.minPaidPrice != null ? (
          <Link href={buildAppLink(platform, comp.appSlug, "details#pricing-plans", version)} className="text-primary hover:underline">
            ${comp.minPaidPrice}/mo
          </Link>
        ) : "\u2014"}
      </TableCell>}
      {isCol("launchedDate") && <TableCell className="text-sm text-muted-foreground">
        {comp.launchedDate ? formatDateOnly(comp.launchedDate) : "\u2014"}
      </TableCell>}
      {isCol("featured") && <TableCell className="text-sm">
        {comp.featuredSections > 0 ? (
          <Link href={buildAppLink(platform, comp.appSlug, "featured", version)} className="text-primary hover:underline">{comp.featuredSections}</Link>
        ) : (
          <span className="text-muted-foreground">{"\u2014"}</span>
        )}
      </TableCell>}
      {isCol("ads") && <TableCell className="text-sm">
        {comp.adKeywords > 0 ? (
          <Link href={buildAppLink(platform, comp.appSlug, "ads", version)} className="text-primary hover:underline">{comp.adKeywords}</Link>
        ) : (
          <span className="text-muted-foreground">{"\u2014"}</span>
        )}
      </TableCell>}
      {isCol("ranked") && <TableCell className="text-sm">
        {comp.rankedKeywordCount > 0 ? (
          <Link href={buildAppLink(platform, comp.appSlug, "keywords", version)} className="text-primary hover:underline">{comp.rankedKeywordCount}</Link>
        ) : (
          <span className="text-muted-foreground">{"\u2014"}</span>
        )}
      </TableCell>}
      {isCol("similar") && <TableCell className="text-sm">
        {comp.reverseSimilarCount > 0 ? (
          <Link href={buildAppLink(platform, comp.appSlug, "similar", version)} className="text-primary hover:underline">{comp.reverseSimilarCount}</Link>
        ) : (
          <span className="text-muted-foreground">{"\u2014"}</span>
        )}
      </TableCell>}
      {isCol("catRank") && <TableCell className="text-sm">
        {(() => {
          const rankings: any[] = comp.categoryRankings ?? [];
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
        })()}
      </TableCell>}
      {isCol("lastChange") && <TableCell className="text-sm">
        {lastChanges[comp.appSlug] ? (
          <Link href={buildAppLink(platform, comp.appSlug, "changes", version)} className="text-primary hover:underline">
            {formatDateOnly(lastChanges[comp.appSlug])}
          </Link>
        ) : "\u2014"}
      </TableCell>}
      {canEdit && (
        <TableCell>
          <div className="flex items-center gap-0.5">
            <a
              href={buildExternalAppUrl(platform as PlatformId, comp.appSlug, comp.externalId)}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            {!comp.isSelf && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  setConfirmRemove({
                    slug: comp.appSlug,
                    name: comp.appName,
                  })
                }
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
