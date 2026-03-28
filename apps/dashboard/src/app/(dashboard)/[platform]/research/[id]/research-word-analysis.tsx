"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ExternalLink } from "lucide-react";
import Link from "next/link";
import { LiveSearchTrigger } from "@/components/live-search-trigger";
import { buildExternalSearchUrl, getPlatformName } from "@/lib/platform-urls";
import { type PlatformId } from "@appranks/shared";

export function MarketLanguage({
  words, totalCompetitors,
}: {
  words: { word: string; totalScore: number; appCount: number; sources: Record<string, number> }[]; totalCompetitors: number;
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
