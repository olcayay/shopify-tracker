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

export default function CompetitorsPage() {
  const { fetchWithAuth, user, account, refreshUser } = useAuth();
  const [competitors, setCompetitors] = useState<any[]>([]);
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
    loadCompetitors();
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

  async function loadCompetitors() {
    setLoading(true);
    const res = await fetchWithAuth("/api/account/competitors");
    if (res.ok) {
      setCompetitors(await res.json());
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
        setSuggestions(await res.json());
        setShowSuggestions(true);
      }
      setSearchLoading(false);
    }, 300);
  }

  async function addCompetitor(slug: string, name: string) {
    setMessage("");
    const res = await fetchWithAuth("/api/account/competitors", {
      method: "POST",
      body: JSON.stringify({ slug }),
    });
    if (res.ok) {
      setMessage(`"${name}" added as competitor.`);
      setQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
      loadCompetitors();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to add competitor");
    }
  }

  async function removeCompetitor(slug: string, name: string) {
    setMessage("");
    const res = await fetchWithAuth(`/api/account/competitors/${slug}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMessage(`"${name}" removed from competitors`);
      loadCompetitors();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to remove competitor");
    }
  }

  const competitorSlugs = new Set(competitors.map((c) => c.appSlug));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Competitor Apps ({competitors.length}
          {account ? `/${account.limits.maxCompetitorApps}` : ""})
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
              placeholder="Search apps to add as competitor..."
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
                    if (competitorSlugs.has(s.slug)) return;
                    addCompetitor(s.slug, s.name);
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
                  {competitorSlugs.has(s.slug) ? (
                    <span className="text-xs text-muted-foreground">
                      Competitor
                    </span>
                  ) : (
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          )}
          {showSuggestions &&
            query.length >= 1 &&
            suggestions.length === 0 &&
            !searchLoading && (
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
                  <TableHead>Added</TableHead>
                  {canEdit && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.map((c) => (
                  <TableRow key={c.appSlug}>
                    <TableCell>
                      <Link
                        href={`/apps/${c.appSlug}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {c.appName || c.appSlug}
                      </Link>
                      {c.isBuiltForShopify && <span title="Built for Shopify" className="ml-1">💎</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setConfirmRemove({
                              slug: c.appSlug,
                              name: c.appName || c.appSlug,
                            })
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {competitors.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={canEdit ? 3 : 2}
                      className="text-center text-muted-foreground"
                    >
                      No competitor apps yet. Use the search above or star apps
                      from their detail page.
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
        title="Remove Competitor"
        description={`Are you sure you want to remove "${confirmRemove?.name}" from competitors?`}
        onConfirm={() => {
          if (confirmRemove) {
            removeCompetitor(confirmRemove.slug, confirmRemove.name);
            setConfirmRemove(null);
          }
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
