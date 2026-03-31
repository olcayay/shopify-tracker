"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";
import { formatNumber } from "@/lib/format-utils";

export function OpportunityTable({
  opportunities,
}: {
  opportunities: {
    keyword: string; slug: string; opportunityScore: number;
    room: number; demand: number; competitorCount: number; totalResults: number | null;
  }[];
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
            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("keyword")} aria-sort={sortKey === "keyword" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>Keyword <SortIcon col="keyword" /></TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("opportunity")} aria-sort={sortKey === "opportunity" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>Opportunity <SortIcon col="opportunity" /></TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("room")} aria-sort={sortKey === "room" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>Room <SortIcon col="room" /></TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("demand")} aria-sort={sortKey === "demand" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>Demand <SortIcon col="demand" /></TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("competitors")} aria-sort={sortKey === "competitors" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>Competitors <SortIcon col="competitors" /></TableHead>
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
                <span className={opp.room >= 0.7 ? "text-green-600 dark:text-green-400" : opp.room >= 0.4 ? "text-yellow-600 dark:text-yellow-500" : "text-red-600 dark:text-red-400"}>
                  {roomLabel(opp.room)}
                </span>
              </TableCell>
              <TableCell className="text-right text-sm">
                {opp.totalResults != null ? formatNumber(opp.totalResults) : "\u2014"}
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
