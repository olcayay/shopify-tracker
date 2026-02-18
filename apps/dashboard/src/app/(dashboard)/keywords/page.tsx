"use client";

import { Fragment, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useFormatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, Plus, Search, Target, Eye, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/confirm-modal";
import { KeywordSearchModal } from "@/components/keyword-search-modal";
import { LiveSearchTrigger } from "@/components/live-search-trigger";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";

export default function KeywordsPage() {
  const { fetchWithAuth, user, account, refreshUser } = useAuth();
  const { formatDateOnly } = useFormatDate();
  const [keywords, setKeywords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<{
    id: number;
    keyword: string;
  } | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const canEdit = user?.role === "owner" || user?.role === "editor";

  useEffect(() => {
    loadKeywords();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadKeywords() {
    setLoading(true);
    const res = await fetchWithAuth("/api/keywords");
    if (res.ok) {
      setKeywords(await res.json());
    }
    setLoading(false);
  }

  function handleSearchInput(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      const res = await fetchWithAuth(
        `/api/keywords/search?q=${encodeURIComponent(value)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
        setShowSuggestions(true);
      }
      setSearchLoading(false);
    }, 300);
  }

  async function trackKeyword(keyword: string) {
    setMessage("");
    const res = await fetchWithAuth("/api/account/tracked-keywords", {
      method: "POST",
      body: JSON.stringify({ keyword }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const scrapeMsg = data.scraperEnqueued
        ? " Scraping started — results will appear shortly."
        : "";
      setMessage(`"${keyword}" added to tracking.${scrapeMsg}`);
      setQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
      loadKeywords();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to track keyword");
    }
  }

  async function untrackKeyword(keywordId: number, keywordText: string) {
    setMessage("");
    const res = await fetchWithAuth(`/api/account/tracked-keywords/${keywordId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMessage(`"${keywordText}" removed from tracking`);
      loadKeywords();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to untrack keyword");
    }
  }

  const trackedIds = new Set(keywords.map((k) => k.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Tracked Keywords ({keywords.length}
          {account ? `/${account.limits.maxTrackedKeywords}` : ""})
        </h1>
        <div className="flex items-center gap-2">
          <AdminScraperTrigger
            scraperType="keyword_search"
            label="Scrape All Keywords"
          />
          <KeywordSearchModal />
        </div>
      </div>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{message}</div>
      )}

      {canEdit && (
        <div ref={searchRef} className="relative max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search keywords to track..."
              value={query}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              className="pl-9"
            />
          </div>
          {showSuggestions && (suggestions.length > 0 || (query.length >= 1 && !searchLoading)) && (
            <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                  onClick={() => {
                    if (trackedIds.has(s.id)) return;
                    trackKeyword(s.keyword);
                  }}
                >
                  <span>{s.keyword}</span>
                  {trackedIds.has(s.id) ? (
                    <span className="text-xs text-muted-foreground">Tracked</span>
                  ) : (
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              ))}
              {query.trim().length >= 1 &&
                !suggestions.some(
                  (s) => s.keyword.toLowerCase() === query.trim().toLowerCase()
                ) && (
                <button
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between border-t"
                  onClick={() => trackKeyword(query.trim())}
                >
                  <span>
                    Track &ldquo;{query.trim()}&rdquo; as new keyword
                  </span>
                  <Plus className="h-4 w-4 text-primary" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Total Results</TableHead>
                  <TableHead>Apps Found</TableHead>
                  <TableHead>Tracked</TableHead>
                  <TableHead>Competitor</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="w-10" />
                  {canEdit && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywords.map((kw) => {
                  const hasApps = kw.trackedInResults > 0 || kw.competitorInResults > 0;
                  const isExpanded = expandedId === kw.id;
                  return (
                  <Fragment key={kw.id}>
                  <TableRow
                    className={hasApps ? "cursor-pointer hover:bg-muted/50" : ""}
                    onClick={() => hasApps && setExpandedId(isExpanded ? null : kw.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {hasApps ? (
                          isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <span className="w-4" />
                        )}
                        <Link
                          href={`/keywords/${kw.slug}`}
                          className="text-primary hover:underline font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {kw.keyword}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>
                      {kw.latestSnapshot?.totalResults?.toLocaleString() ?? "\u2014"}
                    </TableCell>
                    <TableCell>{kw.latestSnapshot?.appCount ?? "\u2014"}</TableCell>
                    <TableCell>
                      {kw.trackedInResults > 0 ? (
                        <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50">
                          <Target className="h-3 w-3 mr-1" />
                          {kw.trackedInResults}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">{"\u2014"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {kw.competitorInResults > 0 ? (
                        <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50">
                          <Eye className="h-3 w-3 mr-1" />
                          {kw.competitorInResults}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">{"\u2014"}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {kw.latestSnapshot?.scrapedAt
                        ? formatDateOnly(kw.latestSnapshot.scrapedAt)
                        : "Never"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <LiveSearchTrigger keyword={kw.keyword} variant="icon" />
                    </TableCell>
                    {canEdit && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setConfirmRemove({
                              id: kw.id,
                              keyword: kw.keyword,
                            })
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 8 : 7} className="bg-muted/30 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {kw.trackedAppsInResults?.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                                <Target className="h-3.5 w-3.5 text-primary" />
                                Tracked Apps
                              </h4>
                              <div className="space-y-1">
                                {kw.trackedAppsInResults.map((app: any) => (
                                  <div key={app.app_slug} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-emerald-500/10 border-l-2 border-l-emerald-500">
                                    <div className="flex items-center gap-2">
                                      {app.logo_url && (
                                        <img src={app.logo_url} alt="" className="h-5 w-5 rounded shrink-0" />
                                      )}
                                      <Link
                                        href={`/apps/${app.app_slug}`}
                                        className="text-primary hover:underline font-medium"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {app.app_name}
                                      </Link>
                                    </div>
                                    <span className="font-mono text-muted-foreground text-xs">
                                      #{app.position}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {kw.competitorAppsInResults?.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                                <Eye className="h-3.5 w-3.5 text-yellow-500" />
                                Competitor Apps
                              </h4>
                              <div className="space-y-1">
                                {kw.competitorAppsInResults.map((app: any) => (
                                  <div key={app.app_slug} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-amber-500/10 border-l-2 border-l-amber-500">
                                    <div className="flex items-center gap-2">
                                      {app.logo_url && (
                                        <img src={app.logo_url} alt="" className="h-5 w-5 rounded shrink-0" />
                                      )}
                                      <Link
                                        href={`/apps/${app.app_slug}`}
                                        className="text-primary hover:underline font-medium"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {app.app_name}
                                      </Link>
                                    </div>
                                    <span className="font-mono text-muted-foreground text-xs">
                                      #{app.position}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                  );
                })}
                {keywords.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={canEdit ? 8 : 7}
                      className="text-center text-muted-foreground"
                    >
                      No tracked keywords yet. Use the search above to find and
                      track keywords.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={!!confirmRemove}
        title="Remove Tracked Keyword"
        description={`Are you sure you want to stop tracking "${confirmRemove?.keyword}"?`}
        onConfirm={() => {
          if (confirmRemove) {
            untrackKeyword(confirmRemove.id, confirmRemove.keyword);
            setConfirmRemove(null);
          }
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
