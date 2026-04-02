"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format-utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, ArrowDown, ExternalLink, Lightbulb, Loader2, Columns3 } from "lucide-react";
import { buildExternalSearchUrl, getPlatformName } from "@/lib/platform-urls";
import type { PlatformId } from "@appranks/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveSearchTrigger } from "@/components/live-search-trigger";
import { KeywordTagBadge } from "@/components/keyword-tag-badge";
import { KeywordTagManager } from "@/components/keyword-tag-manager";
import { KeywordOpportunityPopover } from "@/components/keyword-opportunity-popover";
import type { KeywordOpportunityMetrics } from "@appranks/shared";
import { type SimpleApp, SCORE_DETAIL_COLUMNS, getDetailValue, formatDetailValue, detailCellClass } from "./keywords-section-types";

export function KeywordsTable({
  platform,
  sortedKeywords,
  selectedApps,
  pendingKeywordIds,
  resolvedKeywordIds,
  opportunityData,
  opportunityLoading,
  showScoreDetails,
  sortBySlug,
  sortDirection,
  tags,
  canEdit,
  hasAutoSuggestions,
  onSort,
  onToggleScoreDetails,
  onSetConfirmRemove,
  onSetSuggestionsKeyword,
  onAssignTag,
  onUnassignTag,
  onCreateTag,
  onDeleteTag,
  onUpdateTag,
}: {
  platform: string;
  sortedKeywords: any[];
  selectedApps: SimpleApp[];
  pendingKeywordIds: Set<number>;
  resolvedKeywordIds: Set<number>;
  opportunityData: Record<string, KeywordOpportunityMetrics>;
  opportunityLoading: boolean;
  showScoreDetails: boolean;
  sortBySlug: string;
  sortDirection: "asc" | "desc";
  tags: any[];
  canEdit: boolean;
  hasAutoSuggestions: boolean;
  onSort: (key: string) => void;
  onToggleScoreDetails: () => void;
  onSetConfirmRemove: (data: { keywordId: number; keyword: string }) => void;
  onSetSuggestionsKeyword: (data: { slug: string; keyword: string }) => void;
  onAssignTag: (tagId: string, keywordId: number) => Promise<void>;
  onUnassignTag: (tagId: string, keywordId: number) => Promise<void>;
  onCreateTag: (name: string, color: string) => Promise<void>;
  onDeleteTag: (tagId: string) => Promise<void>;
  onUpdateTag: (tagId: string, color: string, name?: string) => Promise<void>;
}) {
  return (
    <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead {...(showScoreDetails ? { rowSpan: 2 } : {})}>
            <button
              onClick={() => onSort("_alpha")}
              className="flex items-center gap-0.5"
              title="Sort alphabetically"
            >
              Keyword
              {sortBySlug === "_alpha" && (
                <ArrowDown className={cn("h-3 w-3 text-muted-foreground transition-transform", sortDirection === "asc" && "rotate-180")} />
              )}
            </button>
          </TableHead>
          {selectedApps.map((app) => (
            <TableHead key={app.slug} className="text-center w-16" {...(showScoreDetails ? { rowSpan: 2 } : {})}>
              <button
                onClick={() => onSort(app.slug)}
                className="flex items-center justify-center gap-0.5 mx-auto"
                title={`Sort by ${app.name} ranking`}
              >
                {app.iconUrl ? (
                  <img src={app.iconUrl} alt={app.name} className="h-6 w-6 rounded" />
                ) : (
                  <span className="text-xs font-bold">{app.name.charAt(0)}</span>
                )}
                {sortBySlug === app.slug && (
                  <ArrowDown className={cn("h-3 w-3 text-muted-foreground transition-transform", sortDirection === "asc" && "rotate-180")} />
                )}
              </button>
            </TableHead>
          ))}
          <TableHead {...(showScoreDetails ? { rowSpan: 2 } : {})}>Total Results</TableHead>
          <TableHead className="text-center w-16" {...(showScoreDetails ? { rowSpan: 2 } : {})}>
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => onSort("_score")}
                className="flex items-center justify-center gap-0.5"
                title={"Opportunity score (0-100)\nWeighted: Room 40%, Demand 25%, Maturity 10%, Quality 25%\nClick column icon to expand score details."}
              >
                Score
                {sortBySlug === "_score" && (
                  <ArrowDown className={cn("h-3 w-3 text-muted-foreground transition-transform", sortDirection === "asc" && "rotate-180")} />
                )}
              </button>
              <button
                onClick={onToggleScoreDetails}
                className={cn(
                  "p-0.5 rounded hover:bg-accent transition-colors",
                  showScoreDetails && "bg-accent text-foreground"
                )}
                title="Toggle score details"
              >
                <Columns3 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </TableHead>
          {showScoreDetails && (
            <>
              <TableHead colSpan={4} className="bg-muted/30 text-xs font-medium text-muted-foreground text-center border-b">Scores</TableHead>
              <TableHead colSpan={5} className="bg-muted/30 text-xs font-medium text-muted-foreground text-center border-b">First Page</TableHead>
              <TableHead colSpan={2} className="bg-muted/30 text-xs font-medium text-muted-foreground text-center border-b">Concentration</TableHead>
              <TableHead colSpan={4} className="bg-muted/30 text-xs font-medium text-muted-foreground text-center border-b">Top Apps</TableHead>
            </>
          )}
          <TableHead className="w-10" {...(showScoreDetails ? { rowSpan: 2 } : {})} />
          {canEdit && <TableHead className="w-12" {...(showScoreDetails ? { rowSpan: 2 } : {})} />}
        </TableRow>
        {showScoreDetails && (
          <TableRow>
            {SCORE_DETAIL_COLUMNS.map(({ key, label, tooltip }) => (
              <TableHead key={key} className="text-[11px] text-muted-foreground text-center px-2">
                <button
                  onClick={() => onSort(key)}
                  className="flex items-center justify-center gap-0.5 mx-auto"
                  title={tooltip}
                >
                  {label}
                  {sortBySlug === key && (
                    <ArrowDown className={cn("h-2.5 w-2.5 transition-transform", sortDirection === "asc" && "rotate-180")} />
                  )}
                </button>
              </TableHead>
            ))}
            {[1, 2, 3, 4].map((n) => (
              <TableHead key={`top${n}`} className="text-[11px] text-muted-foreground text-center px-2">
                #{n}
              </TableHead>
            ))}
          </TableRow>
        )}
      </TableHeader>
      <TableBody>
        {sortedKeywords.map((kw) => {
          const isPending = pendingKeywordIds.has(kw.keywordId);
          const isResolved = resolvedKeywordIds.has(kw.keywordId);
          return (
          <TableRow
            key={kw.keywordId}
            className={cn(
              isPending && "animate-in fade-in slide-in-from-top duration-300",
            )}
          >
            <TableCell className="group/kw">
              <div>
                <Link
                  href={`/${platform}/keywords/${kw.keywordSlug}`}
                  className="text-primary hover:underline font-medium"
                >
                  {kw.keyword}
                </Link>
                {(kw.tags?.length > 0 || canEdit) && (
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {kw.tags?.map((tag: any) => (
                      <KeywordTagBadge
                        key={tag.id}
                        tag={tag}
                        onRemove={
                          canEdit
                            ? () => onUnassignTag(tag.id, kw.keywordId)
                            : undefined
                        }
                      />
                    ))}
                    {canEdit && (
                      <KeywordTagManager
                        keywordId={kw.keywordId}
                        currentTags={kw.tags || []}
                        allTags={tags}
                        className="opacity-0 group-hover/kw:opacity-100 transition-opacity"
                        onAssign={(tagId) =>
                          onAssignTag(tagId, kw.keywordId)
                        }
                        onUnassign={(tagId) =>
                          onUnassignTag(tagId, kw.keywordId)
                        }
                        onCreateTag={onCreateTag}
                        onDeleteTag={onDeleteTag}
                        onUpdateTag={onUpdateTag}
                      />
                    )}
                  </div>
                )}
              </div>
            </TableCell>
            {selectedApps.map((app) => {
              const position = kw.rankings?.[app.slug];
              return (
                <TableCell key={app.slug} className="text-center">
                  {isPending ? (
                    <Skeleton className="h-4 w-8 mx-auto" />
                  ) : isResolved ? (
                    <span className="animate-in fade-in duration-700 font-semibold text-sm">
                      {position != null ? `#${position}` : "\u2014"}
                    </span>
                  ) : position != null ? (
                    <span className="font-semibold text-sm">#{position}</span>
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </TableCell>
              );
            })}
            <TableCell>
              {isPending ? (
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                </div>
              ) : isResolved ? (
                <span className="animate-in fade-in duration-700">
                  {kw.latestSnapshot?.totalResults ?? "\u2014"}
                </span>
              ) : (
                kw.latestSnapshot?.totalResults ?? "\u2014"
              )}
            </TableCell>
            <TableCell className="text-center">
              {opportunityLoading ? (
                <Skeleton className="h-5 w-8 mx-auto rounded-full" />
              ) : opportunityData[kw.keywordSlug] ? (
                <KeywordOpportunityPopover metrics={opportunityData[kw.keywordSlug]}>
                  <button
                    className={cn(
                      "inline-flex items-center justify-center h-6 min-w-[2rem] px-1.5 rounded-full text-xs font-semibold tabular-nums cursor-pointer transition-colors hover:opacity-80",
                      opportunityData[kw.keywordSlug].opportunityScore >= 60
                        ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                        : opportunityData[kw.keywordSlug].opportunityScore >= 30
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                    )}
                  >
                    {opportunityData[kw.keywordSlug].opportunityScore}
                  </button>
                </KeywordOpportunityPopover>
              ) : (
                <span className="text-muted-foreground">&mdash;</span>
              )}
            </TableCell>
            {showScoreDetails && SCORE_DETAIL_COLUMNS.map(({ key }) => {
              const data = opportunityData[kw.keywordSlug];
              const val = data ? getDetailValue(key, data) : null;
              return (
                <TableCell key={key} className="text-center text-xs tabular-nums px-2">
                  {opportunityLoading ? (
                    <Skeleton className="h-4 w-6 mx-auto" />
                  ) : data ? (
                    <span className={detailCellClass(key, val)}>
                      {formatDetailValue(key, val)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </TableCell>
              );
            })}
            {showScoreDetails && [0, 1, 2, 3].map((i) => {
              const data = opportunityData[kw.keywordSlug];
              const app = data?.topApps[i];
              return (
                <TableCell key={`top${i}`} className="px-2">
                  {opportunityLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : app ? (
                    <div className="flex items-center gap-1 text-xs whitespace-nowrap">
                      {app.logoUrl ? (
                        <img src={app.logoUrl} alt="" aria-hidden="true" className="h-4 w-4 rounded shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded bg-muted shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="truncate max-w-[10ch] font-medium leading-tight">{app.name}</div>
                        <div className="text-muted-foreground text-[10px] leading-tight tabular-nums">
                          {app.rating.toFixed(1)} &middot; {formatNumber(app.reviews)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">&mdash;</span>
                  )}
                </TableCell>
              );
            })}
            <TableCell>
              <div className="flex items-center gap-0.5">
                {hasAutoSuggestions && (kw.hasSuggestions ? (
                  <button
                    onClick={() =>
                      onSetSuggestionsKeyword({
                        slug: kw.keywordSlug,
                        keyword: kw.keyword,
                      })
                    }
                    title={`Suggestions for "${kw.keyword}"`}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors"
                  >
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                  </button>
                ) : (
                  <span className="inline-flex h-8 w-8" />
                ))}
                <LiveSearchTrigger keyword={kw.keyword} variant="icon" />
                <a
                  href={buildExternalSearchUrl(platform as PlatformId, kw.keyword)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Search "${kw.keyword}" on ${getPlatformName(platform as PlatformId)}`}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors"
                >
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
              </div>
            </TableCell>
            {canEdit && (
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    onSetConfirmRemove({
                      keywordId: kw.keywordId,
                      keyword: kw.keyword,
                    })
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
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
