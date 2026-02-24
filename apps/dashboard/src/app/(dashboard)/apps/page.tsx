"use client";

import { useEffect, useState, useRef, useMemo } from "react";
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
import { X, Plus, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";

type SortKey = "name" | "rating" | "reviews" | "minPaidPrice" | "lastChangeAt" | "launchedDate" | "competitorCount" | "keywordCount";
type SortDir = "asc" | "desc";

export default function AppsPage() {
  const { fetchWithAuth, user, account, refreshUser } = useAuth();
  const { formatDateOnly } = useFormatDate();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<{
    slug: string;
    name: string;
  } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const canEdit = user?.role === "owner" || user?.role === "editor";

  useEffect(() => {
    loadApps();
  }, []);

  const sorted = useMemo(() => {
    return [...apps].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = (a.name || a.slug).localeCompare(b.name || b.slug);
          break;
        case "rating":
          cmp = (a.latestSnapshot?.averageRating ?? 0) - (b.latestSnapshot?.averageRating ?? 0);
          break;
        case "reviews":
          cmp = (a.latestSnapshot?.ratingCount ?? 0) - (b.latestSnapshot?.ratingCount ?? 0);
          break;
        case "minPaidPrice":
          cmp = (a.minPaidPrice ?? 0) - (b.minPaidPrice ?? 0);
          break;
        case "lastChangeAt":
          cmp = (a.lastChangeAt || "").localeCompare(b.lastChangeAt || "");
          break;
        case "launchedDate":
          cmp = (a.launchedDate || "").localeCompare(b.launchedDate || "");
          break;
        case "competitorCount":
          cmp = (a.competitorCount ?? 0) - (b.competitorCount ?? 0);
          break;
        case "keywordCount":
          cmp = (a.keywordCount ?? 0) - (b.keywordCount ?? 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [apps, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col)
      return <ArrowUpDown className="inline h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="inline h-3.5 w-3.5 ml-1" />
    ) : (
      <ArrowDown className="inline h-3.5 w-3.5 ml-1" />
    );
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadApps() {
    setLoading(true);
    const res = await fetchWithAuth("/api/apps");
    if (res.ok) {
      setApps(await res.json());
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
        `/api/apps/search?q=${encodeURIComponent(value)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
        setShowSuggestions(true);
      }
      setSearchLoading(false);
    }, 300);
  }

  async function trackApp(slug: string, name: string) {
    setMessage("");
    const res = await fetchWithAuth("/api/account/tracked-apps", {
      method: "POST",
      body: JSON.stringify({ slug }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const scrapeMsg = data.scraperEnqueued
        ? " Scraping started — details will appear shortly."
        : "";
      setMessage(`Now following "${name}".${scrapeMsg}`);
      setQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
      loadApps();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to track app");
    }
  }

  async function untrackApp(slug: string, name: string) {
    setMessage("");
    const res = await fetchWithAuth(`/api/account/tracked-apps/${slug}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMessage(`Unfollowed "${name}"`);
      loadApps();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to untrack app");
    }
  }

  const trackedSlugs = new Set(apps.map((a) => a.slug));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          My Apps ({apps.length}
          {account ? `/${account.limits.maxTrackedApps}` : ""})
        </h1>
        <AdminScraperTrigger
          scraperType="app_details"
          label="Scrape All Apps"
        />
      </div>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{message}</div>
      )}

      {canEdit && (
        <div ref={searchRef} className="relative max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search apps to follow..."
              value={query}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              className="pl-9"
            />
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
              {suggestions.map((s) => (
                <button
                  key={s.slug}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                  onClick={() => {
                    if (trackedSlugs.has(s.slug)) return;
                    trackApp(s.slug, s.name);
                  }}
                >
                  <span>
                    {s.name}
                    {s.averageRating != null && (
                      <span className="text-muted-foreground ml-1">
                        ({Number(s.averageRating).toFixed(1)} / {s.ratingCount?.toLocaleString() ?? 0})
                      </span>
                    )}
                  </span>
                  {trackedSlugs.has(s.slug) ? (
                    <span className="text-xs text-muted-foreground">Following</span>
                  ) : (
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          )}
          {showSuggestions && query.length >= 1 && suggestions.length === 0 && !searchLoading && (
            <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md p-3 text-sm text-muted-foreground">
              No apps found for &ldquo;{query}&rdquo;
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
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                    App <SortIcon col="name" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("rating")}>
                    Rating <SortIcon col="rating" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("reviews")}>
                    Reviews <SortIcon col="reviews" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("competitorCount")}>
                    Competitors <SortIcon col="competitorCount" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("keywordCount")}>
                    Keywords <SortIcon col="keywordCount" />
                  </TableHead>
                  <TableHead>Pricing</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("minPaidPrice")}>
                    Min. Paid <SortIcon col="minPaidPrice" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("lastChangeAt")}>
                    Last Change <SortIcon col="lastChangeAt" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("launchedDate")}>
                    Launched <SortIcon col="launchedDate" />
                  </TableHead>
                  {canEdit && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((app) => (
                  <TableRow key={app.slug}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {app.iconUrl && (
                          <img src={app.iconUrl} alt="" className="h-6 w-6 rounded shrink-0" />
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/apps/${app.slug}`}
                              className="text-primary hover:underline font-medium"
                            >
                              {app.name}
                            </Link>
                            {app.isBuiltForShopify && <span title="Built for Shopify">💎</span>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {app.latestSnapshot?.averageRating ?? "\u2014"}
                    </TableCell>
                    <TableCell>
                      {app.latestSnapshot?.ratingCount != null ? (
                        <Link href={`/apps/${app.slug}/reviews`} className="text-primary hover:underline">
                          {app.latestSnapshot.ratingCount}
                        </Link>
                      ) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.competitorCount ? (
                        <Link href={`/apps/${app.slug}/competitors`} className="text-primary hover:underline">
                          {app.competitorCount}
                        </Link>
                      ) : "0"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.keywordCount ? (
                        <Link href={`/apps/${app.slug}/keywords`} className="text-primary hover:underline">
                          {app.keywordCount}
                        </Link>
                      ) : "0"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.latestSnapshot?.pricing ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.minPaidPrice != null ? (
                        <Link href={`/apps/${app.slug}/details#pricing-plans`} className="text-primary hover:underline">
                          ${app.minPaidPrice}/mo
                        </Link>
                      ) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.lastChangeAt ? (
                        <Link href={`/apps/${app.slug}/changes`} className="text-primary hover:underline">
                          {formatDateOnly(app.lastChangeAt)}
                        </Link>
                      ) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {app.launchedDate
                        ? formatDateOnly(app.launchedDate)
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
                              slug: app.slug,
                              name: app.name,
                            })
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {apps.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={canEdit ? 10 : 9}
                      className="text-center text-muted-foreground"
                    >
                      No apps yet. Search and follow an app to get started.
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
        title="Unfollow App"
        description={`Are you sure you want to unfollow "${confirmRemove?.name}"? Its competitors and keywords will also be removed.`}
        onConfirm={() => {
          if (confirmRemove) {
            untrackApp(confirmRemove.slug, confirmRemove.name);
            setConfirmRemove(null);
          }
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
