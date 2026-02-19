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

export function CompetitorsSection({ appSlug }: { appSlug: string }) {
  const { fetchWithAuth, user, account, refreshUser } = useAuth();
  const { formatDateOnly } = useFormatDate();
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [lastChanges, setLastChanges] = useState<Record<string, string>>({});
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

  async function loadCompetitors() {
    setLoading(true);
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/competitors`
    );
    if (res.ok) {
      const comps = await res.json();
      setCompetitors(comps);

      // Fetch last changes for all competitors
      const slugs = comps.map((c: any) => c.appSlug);
      if (slugs.length > 0) {
        const changesRes = await fetchWithAuth(`/api/apps/last-changes`, {
          method: "POST",
          body: JSON.stringify({ slugs }),
        });
        if (changesRes.ok) {
          setLastChanges(await changesRes.json());
        }
      }
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
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/competitors`,
      {
        method: "POST",
        body: JSON.stringify({ slug }),
      }
    );
    if (res.ok) {
      setMessage(`"${name}" added as competitor`);
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
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/competitors/${encodeURIComponent(slug)}`,
      { method: "DELETE" }
    );
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Competitors for this app
          {account
            ? ` (${account.usage.competitorApps}/${account.limits.maxCompetitorApps} unique across all apps)`
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
              placeholder="Search apps to add as competitor..."
              value={query}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() =>
                suggestions.length > 0 && setShowSuggestions(true)
              }
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
                    if (competitorSlugs.has(s.slug) || s.slug === appSlug)
                      return;
                    addCompetitor(s.slug, s.name);
                  }}
                >
                  <span>
                    {s.name}
                    {s.averageRating != null && (
                      <span className="text-muted-foreground ml-1">
                        ({Number(s.averageRating).toFixed(1)} /{" "}
                        {s.ratingCount?.toLocaleString() ?? 0})
                      </span>
                    )}
                  </span>
                  {s.slug === appSlug ? (
                    <span className="text-xs text-muted-foreground">
                      This app
                    </span>
                  ) : competitorSlugs.has(s.slug) ? (
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
                No apps found
              </div>
            )}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      ) : competitors.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No competitors added yet.
          {canEdit && " Use the search above to add competitors."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>App</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Reviews</TableHead>
              <TableHead>Pricing</TableHead>
              <TableHead>Min. Paid</TableHead>
              <TableHead>Launched</TableHead>
              <TableHead>Last Change</TableHead>
              {canEdit && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {competitors.map((comp) => (
              <TableRow key={comp.appSlug}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {comp.iconUrl && (
                      <img
                        src={comp.iconUrl}
                        alt=""
                        className="h-6 w-6 rounded shrink-0"
                      />
                    )}
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/apps/${comp.appSlug}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {comp.appName}
                      </Link>
                      {comp.isBuiltForShopify && (
                        <span title="Built for Shopify">💎</span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {comp.latestSnapshot?.averageRating ?? "\u2014"}
                </TableCell>
                <TableCell>
                  {comp.latestSnapshot?.ratingCount ?? "\u2014"}
                </TableCell>
                <TableCell className="text-sm">
                  {comp.latestSnapshot?.pricing ?? "\u2014"}
                </TableCell>
                <TableCell className="text-sm">
                  {comp.minPaidPrice != null
                    ? `$${comp.minPaidPrice}/mo`
                    : "\u2014"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {comp.launchedDate
                    ? formatDateOnly(comp.launchedDate)
                    : "\u2014"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {lastChanges[comp.appSlug]
                    ? formatDateOnly(lastChanges[comp.appSlug])
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
                          slug: comp.appSlug,
                          name: comp.appName,
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
