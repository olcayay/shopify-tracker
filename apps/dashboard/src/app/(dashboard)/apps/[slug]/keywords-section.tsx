"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useFormatDate } from "@/lib/format-date";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, Plus, Search } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";

export function KeywordsSection({ appSlug }: { appSlug: string }) {
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
    keywordId: number;
    keyword: string;
  } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const canEdit = user?.role === "owner" || user?.role === "editor";

  useEffect(() => {
    loadKeywords();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadKeywords() {
    setLoading(true);
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/keywords`
    );
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
        setSuggestions(await res.json());
        setShowSuggestions(true);
      }
      setSearchLoading(false);
    }, 300);
  }

  async function addKeyword(keyword: string) {
    setMessage("");
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/keywords`,
      {
        method: "POST",
        body: JSON.stringify({ keyword }),
      }
    );
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const scrapeMsg = data.scraperEnqueued
        ? " Search results will appear shortly."
        : "";
      setMessage(`"${keyword}" added.${scrapeMsg}`);
      setQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
      loadKeywords();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to add keyword");
    }
  }

  async function removeKeyword(keywordId: number, keyword: string) {
    setMessage("");
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/keywords/${keywordId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setMessage(`"${keyword}" removed`);
      loadKeywords();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to remove keyword");
    }
  }

  const trackedKeywordIds = new Set(keywords.map((k) => k.keywordId));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Keywords for this app
          {account
            ? ` (${account.usage.trackedKeywords}/${account.limits.maxTrackedKeywords} unique across all apps)`
            : ""}
        </p>
      </div>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{message}</div>
      )}

      {canEdit && (
        <div ref={searchRef} className="relative max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search or type a new keyword..."
              value={query}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() =>
                suggestions.length > 0 && setShowSuggestions(true)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  addKeyword(query.trim());
                }
              }}
              className="pl-9"
            />
          </div>
          {showSuggestions && (
            <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                  onClick={() => {
                    if (trackedKeywordIds.has(s.id)) return;
                    addKeyword(s.keyword);
                  }}
                >
                  <span>{s.keyword}</span>
                  {trackedKeywordIds.has(s.id) ? (
                    <span className="text-xs text-muted-foreground">
                      Added
                    </span>
                  ) : (
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              ))}
              {query.trim() &&
                !suggestions.some(
                  (s) =>
                    s.keyword.toLowerCase() === query.trim().toLowerCase()
                ) && (
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between border-t"
                    onClick={() => addKeyword(query.trim())}
                  >
                    <span>
                      Track &ldquo;{query.trim()}&rdquo; as new keyword
                    </span>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
            </div>
          )}
          {!showSuggestions &&
            query.length >= 1 &&
            suggestions.length === 0 &&
            !searchLoading && (
              <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md">
                <button
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                  onClick={() => addKeyword(query.trim())}
                >
                  <span>
                    Track &ldquo;{query.trim()}&rdquo; as new keyword
                  </span>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            )}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      ) : keywords.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No keywords added yet.
          {canEdit && " Use the search above or press Enter to add keywords."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Keyword</TableHead>
              <TableHead>Total Results</TableHead>
              <TableHead>Last Updated</TableHead>
              {canEdit && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {keywords.map((kw) => (
              <TableRow key={kw.keywordId}>
                <TableCell>
                  <Link
                    href={`/keywords/${kw.keywordSlug}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {kw.keyword}
                  </Link>
                </TableCell>
                <TableCell>
                  {kw.latestSnapshot?.totalResults ?? "\u2014"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {kw.latestSnapshot?.scrapedAt
                    ? formatDateOnly(kw.latestSnapshot.scrapedAt)
                    : "\u2014"}
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setConfirmRemove({
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
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmModal
        open={!!confirmRemove}
        title="Remove Keyword"
        description={`Are you sure you want to remove "${confirmRemove?.keyword}" from this app's keywords?`}
        onConfirm={() => {
          if (confirmRemove) {
            removeKeyword(confirmRemove.keywordId, confirmRemove.keyword);
            setConfirmRemove(null);
          }
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
