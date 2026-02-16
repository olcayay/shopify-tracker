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
import { ConfirmModal } from "@/components/confirm-modal";

export default function AppsPage() {
  const { fetchWithAuth, user, account, refreshUser } = useAuth();
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

  const canEdit = user?.role === "owner" || user?.role === "editor";

  useEffect(() => {
    loadApps();
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
      setMessage(`"${name}" added to tracking.${scrapeMsg}`);
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
      setMessage(`"${name}" removed from tracking`);
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
          Tracked Apps ({apps.length}
          {account ? `/${account.limits.maxTrackedApps}` : ""})
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
              placeholder="Search apps to track..."
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
                    <span className="text-xs text-muted-foreground">Tracked</span>
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
                  <TableHead>App</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Reviews</TableHead>
                  <TableHead>Pricing</TableHead>
                  <TableHead>Last Updated</TableHead>
                  {canEdit && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((app) => (
                  <TableRow key={app.slug}>
                    <TableCell>
                      <Link
                        href={`/apps/${app.slug}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {app.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {app.latestSnapshot?.averageRating ?? "\u2014"}
                    </TableCell>
                    <TableCell>
                      {app.latestSnapshot?.ratingCount ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.latestSnapshot?.pricing ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {app.latestSnapshot?.scrapedAt
                        ? new Date(
                            app.latestSnapshot.scrapedAt
                          ).toLocaleDateString()
                        : "Never"}
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
                      colSpan={canEdit ? 6 : 5}
                      className="text-center text-muted-foreground"
                    >
                      No tracked apps yet. Use the search above to find and
                      track apps.
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
        title="Remove Tracked App"
        description={`Are you sure you want to stop tracking "${confirmRemove?.name}"?`}
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
