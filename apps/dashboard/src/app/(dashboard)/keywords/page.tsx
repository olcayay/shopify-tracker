"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
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
import { X, Plus, Search } from "lucide-react";

export default function KeywordsPage() {
  const { fetchWithAuth, user, account, refreshUser } = useAuth();
  const [keywords, setKeywords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [message, setMessage] = useState("");
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
                  <TableHead>Last Scraped</TableHead>
                  {canEdit && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywords.map((kw) => (
                  <TableRow key={kw.id}>
                    <TableCell>
                      <Link
                        href={`/keywords/${kw.slug}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {kw.keyword}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {kw.latestSnapshot?.totalResults?.toLocaleString() ?? "\u2014"}
                    </TableCell>
                    <TableCell>{kw.latestSnapshot?.appCount ?? "\u2014"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {kw.latestSnapshot?.scrapedAt
                        ? new Date(kw.latestSnapshot.scrapedAt).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => untrackKeyword(kw.id, kw.keyword)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {keywords.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={canEdit ? 5 : 4}
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
    </div>
  );
}
