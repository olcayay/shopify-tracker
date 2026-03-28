"use client";

import {
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { SortIcon } from "./sort-icon";
import type { SortKey, SortDir } from "./types";

interface CompetitorTableHeadersProps {
  isCol: (key: string) => boolean;
  toggleSort: (key: SortKey) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  canEdit: boolean;
}

export function CompetitorTableHeaders({ isCol, toggleSort, sortKey, sortDir, canEdit }: CompetitorTableHeadersProps) {
  return (
    <TableRow>
      <TableHead
        className="cursor-pointer select-none md:sticky md:left-0 md:z-20 bg-background md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
        onClick={() => toggleSort("name")}
      >
        App <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
      </TableHead>
      {isCol("visibility") && (
        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("visibility")}>
          <Tooltip><TooltipTrigger asChild><span>Visibility <SortIcon col="visibility" sortKey={sortKey} sortDir={sortDir} /></span></TooltipTrigger><TooltipContent>Visibility score for your tracked keywords (0-100)</TooltipContent></Tooltip>
        </TableHead>
      )}
      {isCol("power") && (
        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("power")}>
          <Tooltip><TooltipTrigger asChild><span>Power <SortIcon col="power" sortKey={sortKey} sortDir={sortDir} /></span></TooltipTrigger><TooltipContent>Weighted aggregate power score (0-100)</TooltipContent></Tooltip>
        </TableHead>
      )}
      {isCol("similarity") && (
        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("similarity")}>
          <Tooltip><TooltipTrigger asChild><span>Similarity <SortIcon col="similarity" sortKey={sortKey} sortDir={sortDir} /></span></TooltipTrigger><TooltipContent>Similarity score based on categories, features, keywords, and text</TooltipContent></Tooltip>
        </TableHead>
      )}
      {isCol("rating") && (
        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("rating")}>
          Rating <SortIcon col="rating" sortKey={sortKey} sortDir={sortDir} />
        </TableHead>
      )}
      {isCol("reviews") && (
        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("reviews")}>
          Reviews <SortIcon col="reviews" sortKey={sortKey} sortDir={sortDir} />
        </TableHead>
      )}
      {isCol("v7d") && (
        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("v7d")}>
          <Tooltip><TooltipTrigger asChild><span>R7d <SortIcon col="v7d" sortKey={sortKey} sortDir={sortDir} /></span></TooltipTrigger><TooltipContent>Reviews received in the last 7 days</TooltipContent></Tooltip>
        </TableHead>
      )}
      {isCol("v30d") && (
        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("v30d")}>
          <Tooltip><TooltipTrigger asChild><span>R30d <SortIcon col="v30d" sortKey={sortKey} sortDir={sortDir} /></span></TooltipTrigger><TooltipContent>Reviews received in the last 30 days</TooltipContent></Tooltip>
        </TableHead>
      )}
      {isCol("v90d") && (
        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("v90d")}>
          <Tooltip><TooltipTrigger asChild><span>R90d <SortIcon col="v90d" sortKey={sortKey} sortDir={sortDir} /></span></TooltipTrigger><TooltipContent>Reviews received in the last 90 days</TooltipContent></Tooltip>
        </TableHead>
      )}
      {isCol("momentum") && (
        <TableHead className="cursor-pointer select-none text-center" onClick={() => toggleSort("momentum")}>
          <Tooltip><TooltipTrigger asChild><span>Momentum <SortIcon col="momentum" sortKey={sortKey} sortDir={sortDir} /></span></TooltipTrigger><TooltipContent>Review growth trend: compares recent pace (7d) vs longer-term pace (30d/90d)</TooltipContent></Tooltip>
        </TableHead>
      )}
      {isCol("pricing") && (
        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("pricing")}>
          Pricing <SortIcon col="pricing" sortKey={sortKey} sortDir={sortDir} />
        </TableHead>
      )}
      {isCol("minPaidPrice") && (
        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("minPaidPrice")}>
          <Tooltip><TooltipTrigger asChild><span>Min. Paid <SortIcon col="minPaidPrice" sortKey={sortKey} sortDir={sortDir} /></span></TooltipTrigger><TooltipContent>Lowest paid plan price per month</TooltipContent></Tooltip>
        </TableHead>
      )}
      {isCol("launchedDate") && (
        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("launchedDate")}>
          Launched <SortIcon col="launchedDate" sortKey={sortKey} sortDir={sortDir} />
        </TableHead>
      )}
      {isCol("featured") && (
        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("featured")}>
          <Tooltip><TooltipTrigger asChild><span>Featured <SortIcon col="featured" sortKey={sortKey} sortDir={sortDir} /></span></TooltipTrigger><TooltipContent>Number of featured sections this app appears in</TooltipContent></Tooltip>
        </TableHead>
      )}
      {isCol("adKeywords") && (
        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("adKeywords")}>
          <Tooltip><TooltipTrigger asChild><span>Ads <SortIcon col="adKeywords" sortKey={sortKey} sortDir={sortDir} /></span></TooltipTrigger><TooltipContent>Number of keywords this app is running ads for</TooltipContent></Tooltip>
        </TableHead>
      )}
      {isCol("rankedKeywords") && (
        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("rankedKeywords")}>
          <Tooltip><TooltipTrigger asChild><span>Ranked <SortIcon col="rankedKeywords" sortKey={sortKey} sortDir={sortDir} /></span></TooltipTrigger><TooltipContent>Number of keywords this app ranks for in search results</TooltipContent></Tooltip>
        </TableHead>
      )}
      {isCol("similar") && (
        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("similar")}>
          <Tooltip><TooltipTrigger asChild><span>Similar <SortIcon col="similar" sortKey={sortKey} sortDir={sortDir} /></span></TooltipTrigger><TooltipContent>Number of other apps that list this app as similar</TooltipContent></Tooltip>
        </TableHead>
      )}
      {isCol("catRank") && (
        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("catRank")}>
          Category Rank <SortIcon col="catRank" sortKey={sortKey} sortDir={sortDir} />
        </TableHead>
      )}
      {isCol("lastChangeAt") && (
        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("lastChangeAt")}>
          <Tooltip><TooltipTrigger asChild><span>Last Change <SortIcon col="lastChangeAt" sortKey={sortKey} sortDir={sortDir} /></span></TooltipTrigger><TooltipContent>Date of the most recent detected change in app listing</TooltipContent></Tooltip>
        </TableHead>
      )}
      <TableHead className="w-10" />
      {canEdit && <TableHead className="w-12" />}
    </TableRow>
  );
}
